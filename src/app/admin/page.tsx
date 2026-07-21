"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { defaultLandingContent, normalizeLandingPageContent, type LandingPageContent } from '@/data/landingContent';
import { faqs } from '@/data/faqs';
import { resorts } from '@/data/resorts';
import { services } from '@/data/services';
import { suggestedQuestions } from '@/data/suggestedQuestions';
import { testimonials } from '@/data/testimonials';
import { chatResponses } from '@/data/chatResponses';
import { tourPackages, sharedGroupTours, tourContact } from '@/data/tours';
import { intentKnowledgeSections, extendedKnowledge } from '@/data/extendedKnowledge';
import { auth, db, isFirebaseConfigured, storage } from '@/lib/firebase';

type SectionId = 'overview' | 'carousel' | 'news' | 'data' | 'collections' | 'profile';
type TextFieldKey = Exclude<keyof LandingPageContent, 'imageSlides' | 'newsSlides'>;
type EditableDataKey =
  | 'faqs'
  | 'resorts'
  | 'services'
  | 'suggestedQuestions'
  | 'testimonials'
  | 'tours'
  | 'chatResponses'
  | 'knowledge';

type ContentMode = 'auto' | 'firebase' | 'local';

type ChatStatus = {
  contentMode: ContentMode;
  manualContentMode: ContentMode;
  firebaseContentEnabled: boolean;
  firebaseConfigured: boolean;
  firebaseHealth: {
    status: 'unknown' | 'healthy' | 'unhealthy' | 'skipped';
    lastCheckedAt: number | null;
    lastSuccessAt: number | null;
    lastFailureAt: number | null;
  };
  firebaseBackoffActive: boolean;
  firebaseRetryAt: number | null;
};

type AdminProfile = {
  displayName: string;
  idNumber: string;
  photoUrl: string;
};

const fieldClassName =
  'w-full rounded-xl border border-cyan-300/20 bg-[#0c1f4f]/60 px-3 py-2 text-sm text-white outline-none placeholder:text-cyan-100/40 focus:border-cyan-300/60';

const sections: Array<{ id: SectionId; label: string; hint: string }> = [
  { id: 'overview', label: 'Dashboard', hint: 'Date, time, metrics' },
  { id: 'carousel', label: 'Edit Carousel', hint: 'Add and update slides' },
  { id: 'news', label: 'Edit News', hint: 'Manage news cards' },
  { id: 'data', label: 'Add / Remove Data', hint: 'Search and edit everything' },
  { id: 'collections', label: 'Data Files', hint: 'Edit resorts, faqs, tours, and more' },
  { id: 'profile', label: 'Admin Profile', hint: 'Picture, name, ID' },
];

const dataCollectionLabels: Record<EditableDataKey, string> = {
  faqs: 'FAQs',
  resorts: 'Resorts',
  services: 'Services',
  suggestedQuestions: 'Suggested Questions',
  testimonials: 'Testimonials',
  tours: 'Tours',
  chatResponses: 'Chat Responses',
  knowledge: 'Knowledge Sections',
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toPrettyJson = (value: unknown) => JSON.stringify(value, null, 2);

const buildDefaultPayload = (key: EditableDataKey) => {
  switch (key) {
    case 'faqs':
      return faqs;
    case 'resorts':
      return resorts;
    case 'services':
      return services;
    case 'suggestedQuestions':
      return suggestedQuestions;
    case 'testimonials':
      return testimonials;
    case 'tours':
      return {
        packages: tourPackages,
        sharedGroupTours,
        contact: tourContact,
      };
    case 'chatResponses':
      return chatResponses;
    case 'knowledge':
      return {
        intentSections: intentKnowledgeSections,
        fullText: extendedKnowledge,
      };
    default:
      return {};
  }
};

const getCollectionRef = (key: EditableDataKey) => {
  if (key === 'chatResponses' || key === 'knowledge') {
    return { collectionName: 'siteContent', docId: key };
  }

  return { collectionName: 'contentData', docId: key };
};

const getPayloadFromSnapshot = (key: EditableDataKey, raw: Record<string, unknown> | null) => {
  if (!raw) return buildDefaultPayload(key);

  switch (key) {
    case 'faqs':
    case 'resorts':
    case 'services':
    case 'suggestedQuestions':
    case 'testimonials':
      return Array.isArray(raw.items) ? raw.items : buildDefaultPayload(key);
    case 'tours':
      return {
        packages: Array.isArray(raw.packages) ? raw.packages : tourPackages,
        sharedGroupTours: Array.isArray(raw.sharedGroupTours) ? raw.sharedGroupTours : sharedGroupTours,
        contact: isObject(raw.contact) ? raw.contact : tourContact,
      };
    case 'chatResponses': {
      const defaults = chatResponses;
      const merged: Record<string, string> = {};

      for (const responseKey of Object.keys(defaults)) {
        const value = raw[responseKey];
        merged[responseKey] = typeof value === 'string' ? value : defaults[responseKey as keyof typeof defaults];
      }

      return merged;
    }
    case 'knowledge': {
      const intentSections = isObject(raw.intentSections) ? raw.intentSections : intentKnowledgeSections;
      const normalizedIntentSections = Object.entries(intentSections).reduce<Record<string, string>>((acc, [intent, text]) => {
        if (typeof text === 'string' && text.trim().length > 0) {
          acc[intent] = text;
        }
        return acc;
      }, {});

      return {
        intentSections:
          Object.keys(normalizedIntentSections).length > 0 ? normalizedIntentSections : intentKnowledgeSections,
        fullText:
          typeof raw.fullText === 'string' && raw.fullText.length > 0
            ? raw.fullText
            : extendedKnowledge,
      };
    }
    default:
      return buildDefaultPayload(key);
  }
};

const validateParsedPayload = (key: EditableDataKey, payload: unknown): string | null => {
  switch (key) {
    case 'faqs':
    case 'resorts':
    case 'services':
    case 'suggestedQuestions':
    case 'testimonials':
      return Array.isArray(payload) ? null : 'Expected a JSON array for this data file.';
    case 'tours':
      if (!isObject(payload)) return 'Expected a JSON object with packages, sharedGroupTours, and contact.';
      if (!Array.isArray(payload.packages)) return 'The tours payload must include an array field named packages.';
      if (!Array.isArray(payload.sharedGroupTours)) {
        return 'The tours payload must include an array field named sharedGroupTours.';
      }
      if (!isObject(payload.contact)) return 'The tours payload must include an object field named contact.';
      return null;
    case 'chatResponses':
      return isObject(payload) ? null : 'Expected a JSON object for chat responses.';
    case 'knowledge':
      if (!isObject(payload)) return 'Expected a JSON object with intentSections and fullText.';
      if (!isObject(payload.intentSections)) return 'The knowledge payload must include an object field named intentSections.';
      return null;
    default:
      return 'Unsupported data file type.';
  }
};

const buildSavePayload = (key: EditableDataKey, payload: unknown, uid: string) => {
  const baseMeta = {
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };

  switch (key) {
    case 'faqs':
    case 'resorts':
    case 'services':
    case 'suggestedQuestions':
    case 'testimonials':
      return {
        items: payload,
        ...baseMeta,
      };
    case 'tours': {
      const typedPayload = payload as {
        packages: unknown[];
        sharedGroupTours: unknown[];
        contact: Record<string, unknown>;
      };

      return {
        packages: typedPayload.packages,
        sharedGroupTours: typedPayload.sharedGroupTours,
        contact: typedPayload.contact,
        ...baseMeta,
      };
    }
    case 'chatResponses':
      return {
        ...(payload as Record<string, unknown>),
        ...baseMeta,
      };
    case 'knowledge': {
      const typedPayload = payload as { intentSections: Record<string, unknown>; fullText?: string };
      return {
        intentSections: typedPayload.intentSections,
        fullText: typeof typedPayload.fullText === 'string' ? typedPayload.fullText : extendedKnowledge,
        ...baseMeta,
      };
    }
    default:
      return {
        ...baseMeta,
      };
  }
};

const textFields: Array<{ key: TextFieldKey; label: string; placeholder: string }> = [
  { key: 'badgeTitle', label: 'Badge title', placeholder: 'Astoria Palawan Assistant' },
  { key: 'helperText', label: 'Helper text', placeholder: 'Resort information, tours, dining...' },
  { key: 'eyebrow', label: 'Eyebrow', placeholder: 'Astoria Palawan' },
  { key: 'heading', label: 'Main heading', placeholder: 'How may I help you today?' },
  { key: 'carouselLabel', label: 'Carousel label', placeholder: 'Image Carousel' },
  { key: 'newsLabel', label: 'News label', placeholder: 'News of the Day' },
  { key: 'chatbotLabel', label: 'Chatbot label', placeholder: 'Chatbot' },
  { key: 'chatbotTitle', label: 'Chatbot title', placeholder: 'Talk with Bot' },
  { key: 'chatbotSubtitle', label: 'Chatbot subtitle', placeholder: 'Open the assistant' },
];

export default function AdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [contentStatus, setContentStatus] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [form, setForm] = useState<LandingPageContent>(defaultLandingContent);
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDataKey, setSelectedDataKey] = useState<EditableDataKey>('resorts');
  const [dataJson, setDataJson] = useState('');
  const [dataStatus, setDataStatus] = useState('');
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isDataSaving, setIsDataSaving] = useState(false);
  const [isRefreshingKnowledge, setIsRefreshingKnowledge] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [uploadingSlideIndex, setUploadingSlideIndex] = useState<number | null>(null);
  const [chatStatus, setChatStatus] = useState<ChatStatus | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [isSwitchingContentMode, setIsSwitchingContentMode] = useState(false);
  const [sessionEdits, setSessionEdits] = useState(0);
  const [noSignupUsers, setNoSignupUsers] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [adminCollection, setAdminCollection] = useState<'admins' | 'admin'>('admins');
  const [profile, setProfile] = useState<AdminProfile>({
    displayName: '',
    idNumber: '',
    photoUrl: '',
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!auth || !db || !isFirebaseConfigured) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setContentStatus('');
      setProfileStatus('');

      if (!nextUser) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      const [adminsSnap, adminSnap] = await Promise.all([
        getDoc(doc(db, 'admins', nextUser.uid)),
        getDoc(doc(db, 'admin', nextUser.uid)),
      ]);

      const isAdminsDoc = adminsSnap.exists();
      const activeDoc = isAdminsDoc ? adminsSnap : adminSnap;
      const allowed = activeDoc.exists() && activeDoc.data().active !== false;

      setAdminCollection(isAdminsDoc ? 'admins' : 'admin');
      setIsAdmin(allowed);

      if (allowed) {
        const data = activeDoc.data() ?? {};
        setProfile({
          displayName: typeof data.displayName === 'string' ? data.displayName : nextUser.displayName ?? '',
          idNumber: typeof data.idNumber === 'string' ? data.idNumber : '',
          photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : nextUser.photoURL ?? '',
        });

        const contentSnap = await getDoc(doc(db, 'siteContent', 'landingPage'));
        if (contentSnap.exists()) {
          setForm(normalizeLandingPageContent(contentSnap.data()));
        } else {
          setForm(defaultLandingContent);
        }
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const canRenderForm = useMemo(
    () => isFirebaseConfigured && !isLoading && !!user && isAdmin,
    [isLoading, isAdmin, user]
  );

  useEffect(() => {
    if (!canRenderForm) return;
    const storageKey = 'astoria-admin-no-signup-users';
    const current = Number(window.localStorage.getItem(storageKey) ?? '0') || 0;
    const next = current + 1;
    window.localStorage.setItem(storageKey, String(next));
    setNoSignupUsers(next);
  }, [canRenderForm]);

  useEffect(() => {
    if (!canRenderForm) {
      setIsSidebarOpen(false);
    }
  }, [canRenderForm]);

  const loadCollectionJson = async (key: EditableDataKey) => {
    if (!db || !user || !isAdmin) return;

    try {
      setIsDataLoading(true);
      setDataStatus('');

      const ref = getCollectionRef(key);
      const snapshot = await getDoc(doc(db, ref.collectionName, ref.docId));
      const raw = snapshot.exists() && isObject(snapshot.data()) ? snapshot.data() : null;
      const payload = getPayloadFromSnapshot(key, raw);
      setDataJson(toPrettyJson(payload));
      setDataStatus(`${dataCollectionLabels[key]} loaded.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Loading data failed.';
      setDataStatus(message);
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    if (!canRenderForm) return;
    void loadCollectionJson(selectedDataKey);
  }, [canRenderForm, selectedDataKey]);

  const saveCollectionJson = async () => {
    if (!db || !user || !isAdmin) return;

    try {
      setIsDataSaving(true);
      setDataStatus('');

      const parsed = JSON.parse(dataJson) as unknown;
      const validationError = validateParsedPayload(selectedDataKey, parsed);

      if (validationError) {
        setDataStatus(validationError);
        return;
      }

      const ref = getCollectionRef(selectedDataKey);
      const payload = buildSavePayload(selectedDataKey, parsed, user.uid);

      await setDoc(doc(db, ref.collectionName, ref.docId), payload, { merge: true });
      setDataStatus(`${dataCollectionLabels[selectedDataKey]} saved successfully.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Saving data failed.';
      setDataStatus(message);
    } finally {
      setIsDataSaving(false);
    }
  };

  const resetCollectionJson = () => {
    const defaults = buildDefaultPayload(selectedDataKey);
    setDataJson(toPrettyJson(defaults));
    setDataStatus(`${dataCollectionLabels[selectedDataKey]} reset to code defaults in editor.`);
  };

  const parsedCollection = useMemo(() => {
    try {
      return dataJson.trim().length ? JSON.parse(dataJson) : null;
    } catch {
      return null;
    }
  }, [dataJson]);

  const useStructuredEditor = selectedDataKey === 'faqs' || selectedDataKey === 'resorts' || selectedDataKey === 'services';
  const collectionHasInvalidJson = dataJson.trim().length > 0 && parsedCollection === null;

  const updateArrayCollection = (
    expectedKey: 'faqs' | 'resorts' | 'services',
    updater: (items: Array<Record<string, unknown>>) => Array<Record<string, unknown>>,
    successMessage: string
  ) => {
    if (selectedDataKey !== expectedKey) return;
    if (!Array.isArray(parsedCollection)) {
      setDataStatus('Please fix JSON first before using form editing.');
      return;
    }

    const normalizedItems = parsedCollection.filter(isObject).map((item) => ({ ...item }));
    const nextItems = updater(normalizedItems);
    setDataJson(toPrettyJson(nextItems));
    setDataStatus(successMessage);
    setSessionEdits((count) => count + 1);
  };

  const refreshKnowledgeNow = async () => {
    try {
      setIsRefreshingKnowledge(true);
      setDataStatus('Refreshing chatbot knowledge...');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refreshKnowledge' }),
      });

      if (!response.ok) {
        const fallback = await response.text();
        setDataStatus(fallback || 'Knowledge refresh failed.');
        return;
      }

      setDataStatus('Chatbot knowledge refreshed successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Knowledge refresh failed.';
      setDataStatus(message);
    } finally {
      setIsRefreshingKnowledge(false);
    }
  };

  const fetchChatStatus = async (silent = false) => {
    try {
      if (!silent) setIsStatusLoading(true);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' }),
      });

      if (!response.ok) {
        if (!silent) {
          const fallback = await response.text();
          setDataStatus(fallback || 'Unable to read chatbot status.');
        }
        return;
      }

      const payload = (await response.json()) as ChatStatus;
      setChatStatus(payload);
    } catch (error) {
      if (!silent) {
        const message = error instanceof Error ? error.message : 'Unable to read chatbot status.';
        setDataStatus(message);
      }
    } finally {
      if (!silent) setIsStatusLoading(false);
    }
  };

  const switchContentMode = async (mode: ContentMode) => {
    try {
      setIsSwitchingContentMode(true);
      setDataStatus('Switching chatbot content mode...');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setContentMode', mode }),
      });

      if (!response.ok) {
        const fallback = await response.text();
        setDataStatus(fallback || 'Unable to switch content mode.');
        return;
      }

      await fetchChatStatus(true);
      setDataStatus(`Chatbot content mode switched to ${mode}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to switch content mode.';
      setDataStatus(message);
    } finally {
      setIsSwitchingContentMode(false);
    }
  };

  useEffect(() => {
    if (!canRenderForm) return;
    void fetchChatStatus(true);

    const timer = window.setInterval(() => {
      void fetchChatStatus(true);
    }, 20000);

    return () => window.clearInterval(timer);
  }, [canRenderForm]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth) return;

    try {
      setContentStatus('');
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign-in failed.';
      setContentStatus(message);
    }
  };

  const saveContent = async () => {
    if (!db || !user || !isAdmin) return;

    try {
      setIsSaving(true);
      setContentStatus('');

      const payload = normalizeLandingPageContent(form);
      await setDoc(
        doc(db, 'siteContent', 'landingPage'),
        {
          ...payload,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      setForm(payload);
      setContentStatus('Changes saved successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed.';
      setContentStatus(message);
    } finally {
      setIsSaving(false);
    }
  };

  const saveProfile = async () => {
    if (!db || !user || !isAdmin) return;

    try {
      setIsSavingProfile(true);
      setProfileStatus('');

      await setDoc(
        doc(db, adminCollection, user.uid),
        {
          displayName: profile.displayName.trim(),
          idNumber: profile.idNumber.trim(),
          photoUrl: profile.photoUrl.trim(),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      setProfileStatus('Profile saved successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Profile save failed.';
      setProfileStatus(message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const seedAllDataToFirebase = async () => {
    if (!db || !user || !isAdmin) return;

    try {
      setIsSeeding(true);
      setContentStatus('');

      const normalizedLanding = normalizeLandingPageContent(form);
      const batch = writeBatch(db);

      batch.set(
        doc(db, 'siteContent', 'landingPage'),
        {
          ...normalizedLanding,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      batch.set(
        doc(db, 'siteContent', 'chatResponses'),
        {
          ...chatResponses,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      batch.set(
        doc(db, 'siteContent', 'knowledge'),
        {
          intentSections: intentKnowledgeSections,
          fullText: extendedKnowledge,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      batch.set(
        doc(db, 'contentData', 'faqs'),
        {
          items: faqs,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      batch.set(
        doc(db, 'contentData', 'resorts'),
        {
          items: resorts,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      batch.set(
        doc(db, 'contentData', 'services'),
        {
          items: services,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      batch.set(
        doc(db, 'contentData', 'tours'),
        {
          packages: tourPackages,
          sharedGroupTours,
          contact: tourContact,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      batch.set(
        doc(db, 'contentData', 'suggestedQuestions'),
        {
          items: suggestedQuestions,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      batch.set(
        doc(db, 'contentData', 'testimonials'),
        {
          items: testimonials,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      batch.set(
        doc(db, 'seedData', 'meta'),
        {
          seededAt: serverTimestamp(),
          seededBy: user.uid,
          totals: {
            faqCount: faqs.length,
            resortCount: resorts.length,
            serviceCount: services.length,
            tourPackageCount: tourPackages.length,
            suggestedQuestionCount: suggestedQuestions.length,
            testimonialCount: testimonials.length,
            carouselCount: normalizedLanding.imageSlides.length,
            newsCount: normalizedLanding.newsSlides.length,
          },
        },
        { merge: true }
      );

      await batch.commit();
      setForm(normalizedLanding);
      setContentStatus('All data has been uploaded to Firebase successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Seeding all data failed.';
      setContentStatus(message);
    } finally {
      setIsSeeding(false);
    }
  };

  const updateTextField = (field: TextFieldKey, value: string) => {
    setSessionEdits((count) => count + 1);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateImageSlide = (
    index: number,
    key: keyof LandingPageContent['imageSlides'][number],
    value: string
  ) => {
    setSessionEdits((count) => count + 1);
    setForm((current) => ({
      ...current,
      imageSlides: current.imageSlides.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  const updateNewsSlide = (
    index: number,
    key: keyof LandingPageContent['newsSlides'][number],
    value: string
  ) => {
    setSessionEdits((count) => count + 1);
    setForm((current) => ({
      ...current,
      newsSlides: current.newsSlides.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  const addSlide = () => {
    setSessionEdits((count) => count + 1);
    setForm((current) => ({
      ...current,
      imageSlides: [
        ...current.imageSlides,
        {
          title: 'New slide',
          subtitle: 'Slide details',
          focus: 'center',
          imageUrl: '/icons/astoria-bg.webp',
        },
      ],
    }));
  };

  const removeSlide = (index: number) => {
    setSessionEdits((count) => count + 1);
    setForm((current) => ({
      ...current,
      imageSlides: current.imageSlides.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const addNews = () => {
    setSessionEdits((count) => count + 1);
    setForm((current) => ({
      ...current,
      newsSlides: [...current.newsSlides, { title: 'News title', body: 'News content' }],
    }));
  };

  const removeNews = (index: number) => {
    setSessionEdits((count) => count + 1);
    setForm((current) => ({
      ...current,
      newsSlides: current.newsSlides.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const uploadCarouselImage = async (index: number, file: File) => {
    if (!storage || !user || !isAdmin) {
      setContentStatus('Image upload is unavailable. Check Firebase Storage configuration.');
      return;
    }

    try {
      setUploadingSlideIndex(index);
      setContentStatus('Uploading image...');

      const extension = file.name.split('.').pop() ?? 'jpg';
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
      const imageRef = storageRef(storage, `admin/carousel/${user.uid}/${uniqueName}`);

      await uploadBytes(imageRef, file);
      const imageUrl = await getDownloadURL(imageRef);

      updateImageSlide(index, 'imageUrl', imageUrl);
      setContentStatus('Image uploaded. Save all changes to publish this slide update.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Image upload failed.';
      setContentStatus(message);
    } finally {
      setUploadingSlideIndex(null);
    }
  };

  const searchValue = searchTerm.trim().toLowerCase();

  const filteredTextFields = textFields.filter(({ key, label }) => {
    if (!searchValue) return true;
    const value = String(form[key] ?? '').toLowerCase();
    return label.toLowerCase().includes(searchValue) || value.includes(searchValue) || String(key).includes(searchValue);
  });

  const filteredImageSlides = form.imageSlides.filter((slide) => {
    if (!searchValue) return true;
    return [slide.title, slide.subtitle, slide.imageUrl, slide.focus].some((item) =>
      item.toLowerCase().includes(searchValue)
    );
  });

  const filteredNewsSlides = form.newsSlides.filter((slide) => {
    if (!searchValue) return true;
    return [slide.title, slide.body].some((item) => item.toLowerCase().includes(searchValue));
  });

  const metrics = [
    { label: 'No-signup users (device estimate)', value: noSignupUsers, detail: 'Tracks visits on this admin device' },
    { label: 'Carousel slides', value: form.imageSlides.length, detail: 'Slides currently shown to users' },
    { label: 'News cards', value: form.newsSlides.length, detail: 'News items currently active' },
    { label: 'Session edits', value: sessionEdits, detail: 'Changes made in this session' },
  ];

  if (!isFirebaseConfigured) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#08153a] via-[#0a2a72] to-[#03c5f8] px-4 py-10 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-cyan-200/30 bg-[#0f2255]/70 p-6 backdrop-blur">
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <p className="mt-3 text-sm text-cyan-100/90">
            Firebase environment values are missing. Add your NEXT_PUBLIC_FIREBASE variables to enable login and editing.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#08153a] via-[#0a2a72] to-[#03c5f8] px-3 py-6 text-white sm:px-4 lg:px-6">
      <div className="mx-auto max-w-7xl">
        {!user ? (
          <section className="mx-auto mt-10 w-full max-w-md rounded-3xl border border-cyan-200/30 bg-[#0f2255]/75 p-6 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-3">
              <img
                src="/icons/astoria-logo.svg"
                alt="Astoria Palawan logo"
                className="h-12 w-12 rounded-md border border-cyan-200/30 bg-white/80 object-cover"
              />
              <h1 className="text-2xl font-semibold">Astoria Admin Login</h1>
            </div>
            <p className="mt-2 text-sm text-cyan-100/80">Sign in to manage carousel, news, and dashboard data.</p>
            <form onSubmit={login} className="mt-5 space-y-3">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Admin email"
                className={fieldClassName}
              />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className={fieldClassName}
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#04204e] transition hover:bg-cyan-300"
              >
                Sign in
              </button>
            </form>
            {contentStatus ? (
              <p className="mt-3 rounded-xl border border-cyan-200/30 bg-[#152f6c]/70 px-3 py-2 text-xs text-cyan-100/90">
                {contentStatus}
              </p>
            ) : null}
          </section>
        ) : null}

        {user && !isAdmin && !isLoading ? (
          <section className="mx-auto mt-10 w-full max-w-2xl rounded-3xl border border-rose-300/40 bg-[#3a1b44]/75 p-6">
            <h2 className="text-xl font-semibold text-rose-100">Access denied</h2>
            <p className="mt-2 text-sm text-rose-100/90">
              Add this user UID into Firestore as active: admins/{user.uid} or admin/{user.uid}.
            </p>
            <button
              type="button"
              onClick={() => auth && signOut(auth)}
              className="mt-4 rounded-xl border border-rose-200/40 px-4 py-2 text-sm text-rose-100"
            >
              Sign out
            </button>
          </section>
        ) : null}

        {canRenderForm ? (
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            {isSidebarOpen ? (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 z-30 bg-[#010712]/65 lg:hidden"
                aria-label="Close menu"
              />
            ) : null}

            <aside
              className={`fixed inset-y-0 left-0 z-40 w-[86vw] max-w-[320px] overflow-y-auto border-r border-cyan-200/25 bg-[#0f2255]/95 p-3 backdrop-blur transition-transform duration-200 lg:static lg:w-auto lg:max-w-none lg:rounded-3xl lg:border lg:bg-[#0f2255]/75 ${
                isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
              }`}
            >
              <div className="rounded-2xl border border-cyan-200/20 bg-[#132d68]/60 p-3">
                <div className="flex items-center gap-2">
                  <img
                    src="/icons/astoria-logo.svg"
                    alt="Astoria Palawan logo"
                    className="h-10 w-10 rounded-md border border-cyan-200/30 bg-white/80 object-cover"
                  />
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Astoria Admin</p>
                    <p className="mt-1 text-sm text-cyan-50/90">{user.email ?? 'Signed in admin'}</p>
                  </div>
                </div>
              </div>

              <nav className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => {
                      setActiveSection(section.id);
                      setIsSidebarOpen(false);
                    }}
                    className={`rounded-2xl border px-3 py-2 text-left transition ${
                      activeSection === section.id
                        ? 'border-cyan-300/70 bg-cyan-300/20 text-white'
                        : 'border-cyan-200/20 bg-[#132d68]/50 text-cyan-100/85 hover:border-cyan-200/45'
                    }`}
                  >
                    <p className="text-sm font-medium">{section.label}</p>
                    <p className="text-[11px] text-cyan-100/70">{section.hint}</p>
                  </button>
                ))}
              </nav>

              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={saveContent}
                  disabled={isSaving}
                  className="rounded-xl bg-cyan-400 px-3 py-2 text-sm font-semibold text-[#04204e] transition hover:bg-cyan-300 disabled:opacity-70"
                >
                  {isSaving ? 'Saving...' : 'Save all changes'}
                </button>
                <button
                  type="button"
                  onClick={seedAllDataToFirebase}
                  disabled={isSeeding}
                  className="rounded-xl border border-cyan-200/35 bg-[#0d2862]/75 px-3 py-2 text-sm text-cyan-100 transition hover:border-cyan-200/60 disabled:opacity-70"
                >
                  {isSeeding ? 'Uploading all data...' : 'Upload all data to Firebase'}
                </button>
                <button
                  type="button"
                  onClick={() => auth && signOut(auth)}
                  className="rounded-xl border border-cyan-200/35 px-3 py-2 text-sm text-cyan-100"
                >
                  Sign out
                </button>
              </div>
            </aside>

            <section className="rounded-3xl border border-cyan-200/25 bg-[#0f2255]/75 p-4 backdrop-blur sm:p-5 lg:p-6">
              <div className="mb-3 lg:hidden">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/35 bg-[#0d2862]/75 px-3 py-2 text-sm text-cyan-100"
                >
                  <span className="inline-flex h-3.5 w-4 flex-col justify-between" aria-hidden="true">
                    <span className="block h-[2px] w-full rounded-full bg-cyan-100" />
                    <span className="block h-[2px] w-full rounded-full bg-cyan-100" />
                    <span className="block h-[2px] w-full rounded-full bg-cyan-100" />
                  </span>
                  Menu
                </button>
              </div>

              <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-200/20 bg-[#132d68]/50 p-3">
                <div>
                  <h1 className="text-xl font-semibold sm:text-2xl">Admin Dashboard</h1>
                  <p className="text-xs text-cyan-100/80 sm:text-sm">
                    {now.toLocaleDateString()} • {now.toLocaleTimeString()}
                  </p>
                </div>
                <div className="rounded-xl border border-cyan-200/25 bg-[#0d2862]/70 px-3 py-2 text-xs text-cyan-100/90">
                  Live metrics update as you edit data.
                </div>
              </header>

              {contentStatus ? (
                <p className="mt-3 rounded-xl border border-cyan-200/30 bg-[#152f6c]/70 px-3 py-2 text-xs text-cyan-100/90">
                  {contentStatus}
                </p>
              ) : null}

              {activeSection === 'overview' ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {metrics.map((metric) => (
                      <article key={metric.label} className="rounded-2xl border border-cyan-200/20 bg-[#122b63]/65 p-3">
                        <p className="text-xs uppercase tracking-[0.12em] text-cyan-100/65">{metric.label}</p>
                        <p className="mt-2 text-2xl font-semibold text-cyan-100">{metric.value}</p>
                        <p className="mt-1 text-[11px] text-cyan-100/70">{metric.detail}</p>
                      </article>
                    ))}
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <article className="rounded-2xl border border-cyan-200/20 bg-[#122b63]/65 p-4">
                      <h2 className="text-base font-semibold">Carousel Preview</h2>
                      <ul className="mt-3 space-y-2">
                        {form.imageSlides.slice(0, 4).map((slide, index) => (
                          <li key={`${slide.title}-${index}`} className="rounded-xl border border-cyan-200/20 bg-[#0d2862]/60 p-2">
                            <p className="text-sm font-medium text-cyan-50">{slide.title}</p>
                            <p className="text-xs text-cyan-100/75">{slide.subtitle}</p>
                          </li>
                        ))}
                      </ul>
                    </article>

                    <article className="rounded-2xl border border-cyan-200/20 bg-[#122b63]/65 p-4">
                      <h2 className="text-base font-semibold">News Preview</h2>
                      <ul className="mt-3 space-y-2">
                        {form.newsSlides.slice(0, 4).map((news, index) => (
                          <li key={`${news.title}-${index}`} className="rounded-xl border border-cyan-200/20 bg-[#0d2862]/60 p-2">
                            <p className="text-sm font-medium text-cyan-50">{news.title}</p>
                            <p className="text-xs text-cyan-100/75">{news.body}</p>
                          </li>
                        ))}
                      </ul>
                    </article>
                  </div>
                </div>
              ) : null}

              {activeSection === 'carousel' ? (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">Edit Carousel</h2>
                    <button
                      type="button"
                      onClick={addSlide}
                      className="rounded-xl border border-cyan-200/35 bg-[#0d2862]/70 px-3 py-1.5 text-xs text-cyan-100"
                    >
                      Add slide
                    </button>
                  </div>

                  {form.imageSlides.map((slide, index) => (
                    <article key={`carousel-${index}`} className="rounded-2xl border border-cyan-200/20 bg-[#122b63]/65 p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          className={fieldClassName}
                          value={slide.title}
                          onChange={(event) => updateImageSlide(index, 'title', event.target.value)}
                          placeholder="Slide title"
                        />
                        <input
                          className={fieldClassName}
                          value={slide.subtitle}
                          onChange={(event) => updateImageSlide(index, 'subtitle', event.target.value)}
                          placeholder="Slide subtitle"
                        />
                        <input
                          className={fieldClassName}
                          value={slide.imageUrl}
                          onChange={(event) => updateImageSlide(index, 'imageUrl', event.target.value)}
                          placeholder="Image URL"
                        />
                        <input
                          className={fieldClassName}
                          value={slide.focus}
                          onChange={(event) => updateImageSlide(index, 'focus', event.target.value)}
                          placeholder="center / top / bottom"
                        />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer rounded-lg border border-cyan-200/35 bg-[#0d2862]/70 px-3 py-1 text-xs text-cyan-100">
                          {uploadingSlideIndex === index ? 'Uploading image...' : 'Upload image'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingSlideIndex === index}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) {
                                void uploadCarouselImage(index, file);
                              }
                              event.currentTarget.value = '';
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            updateImageSlide(index, 'imageUrl', '');
                            setContentStatus('Slide image removed. Save all changes to publish this update.');
                          }}
                          className="rounded-lg border border-rose-300/40 px-3 py-1 text-xs text-rose-100"
                        >
                          Remove image
                        </button>
                        <p className="text-[11px] text-cyan-100/75">Select an image file to auto-fill the Image URL.</p>
                      </div>

                      {form.imageSlides.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeSlide(index)}
                          className="mt-2 rounded-lg border border-rose-300/40 px-3 py-1 text-xs text-rose-100"
                        >
                          Remove slide
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : null}

              {activeSection === 'news' ? (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">Edit News</h2>
                    <button
                      type="button"
                      onClick={addNews}
                      className="rounded-xl border border-cyan-200/35 bg-[#0d2862]/70 px-3 py-1.5 text-xs text-cyan-100"
                    >
                      Add news card
                    </button>
                  </div>

                  {form.newsSlides.map((slide, index) => (
                    <article key={`news-${index}`} className="rounded-2xl border border-cyan-200/20 bg-[#122b63]/65 p-3">
                      <input
                        className={fieldClassName}
                        value={slide.title}
                        onChange={(event) => updateNewsSlide(index, 'title', event.target.value)}
                        placeholder="News title"
                      />
                      <textarea
                        className={`${fieldClassName} mt-2`}
                        rows={3}
                        value={slide.body}
                        onChange={(event) => updateNewsSlide(index, 'body', event.target.value)}
                        placeholder="News content"
                      />

                      {form.newsSlides.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeNews(index)}
                          className="mt-2 rounded-lg border border-rose-300/40 px-3 py-1 text-xs text-rose-100"
                        >
                          Remove news
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : null}

              {activeSection === 'data' ? (
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className={`${fieldClassName} max-w-xl`}
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search data to change (example: spa pricing, headline, pool, news title)"
                    />
                    <button
                      type="button"
                      onClick={addSlide}
                      className="rounded-xl border border-cyan-200/35 bg-[#0d2862]/70 px-3 py-2 text-xs text-cyan-100"
                    >
                      Add slide
                    </button>
                    <button
                      type="button"
                      onClick={addNews}
                      className="rounded-xl border border-cyan-200/35 bg-[#0d2862]/70 px-3 py-2 text-xs text-cyan-100"
                    >
                      Add news
                    </button>
                    <button
                      type="button"
                      onClick={seedAllDataToFirebase}
                      disabled={isSeeding}
                      className="rounded-xl border border-cyan-200/35 bg-[#0d2862]/70 px-3 py-2 text-xs text-cyan-100 disabled:opacity-70"
                    >
                      {isSeeding ? 'Uploading...' : 'Upload all data'}
                    </button>
                  </div>

                  <article className="rounded-2xl border border-cyan-200/20 bg-[#122b63]/65 p-3">
                    <h3 className="text-base font-semibold">All text fields ({filteredTextFields.length})</h3>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {filteredTextFields.map(({ key, label, placeholder }) => (
                        <div key={key} className="rounded-xl border border-cyan-200/20 bg-[#0d2862]/60 p-2">
                          <p className="mb-1 text-xs text-cyan-100/70">{label}</p>
                          <input
                            className={fieldClassName}
                            value={String(form[key])}
                            onChange={(event) => updateTextField(key, event.target.value)}
                            placeholder={placeholder}
                          />
                          <button
                            type="button"
                            onClick={() => updateTextField(key, '')}
                            className="mt-2 rounded-lg border border-rose-300/40 px-2 py-1 text-[11px] text-rose-100"
                          >
                            Clear value
                          </button>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="rounded-2xl border border-cyan-200/20 bg-[#122b63]/65 p-3">
                    <h3 className="text-base font-semibold">All carousel data ({filteredImageSlides.length})</h3>
                    <div className="mt-2 space-y-2">
                      {filteredImageSlides.map((slide) => {
                        const index = form.imageSlides.findIndex((item) => item === slide);
                        if (index === -1) return null;

                        return (
                          <div key={`data-image-${index}`} className="rounded-xl border border-cyan-200/20 bg-[#0d2862]/60 p-2">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <input
                                className={fieldClassName}
                                value={slide.title}
                                onChange={(event) => updateImageSlide(index, 'title', event.target.value)}
                                placeholder="Slide title"
                              />
                              <input
                                className={fieldClassName}
                                value={slide.subtitle}
                                onChange={(event) => updateImageSlide(index, 'subtitle', event.target.value)}
                                placeholder="Slide subtitle"
                              />
                              <input
                                className={fieldClassName}
                                value={slide.imageUrl}
                                onChange={(event) => updateImageSlide(index, 'imageUrl', event.target.value)}
                                placeholder="Image URL"
                              />
                              <input
                                className={fieldClassName}
                                value={slide.focus}
                                onChange={(event) => updateImageSlide(index, 'focus', event.target.value)}
                                placeholder="Focus"
                              />
                            </div>
                            {form.imageSlides.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removeSlide(index)}
                                className="mt-2 rounded-lg border border-rose-300/40 px-2 py-1 text-[11px] text-rose-100"
                              >
                                Remove this slide
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </article>

                  <article className="rounded-2xl border border-cyan-200/20 bg-[#122b63]/65 p-3">
                    <h3 className="text-base font-semibold">All news data ({filteredNewsSlides.length})</h3>
                    <div className="mt-2 space-y-2">
                      {filteredNewsSlides.map((slide) => {
                        const index = form.newsSlides.findIndex((item) => item === slide);
                        if (index === -1) return null;

                        return (
                          <div key={`data-news-${index}`} className="rounded-xl border border-cyan-200/20 bg-[#0d2862]/60 p-2">
                            <input
                              className={fieldClassName}
                              value={slide.title}
                              onChange={(event) => updateNewsSlide(index, 'title', event.target.value)}
                              placeholder="News title"
                            />
                            <textarea
                              className={`${fieldClassName} mt-2`}
                              rows={3}
                              value={slide.body}
                              onChange={(event) => updateNewsSlide(index, 'body', event.target.value)}
                              placeholder="News body"
                            />
                            {form.newsSlides.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removeNews(index)}
                                className="mt-2 rounded-lg border border-rose-300/40 px-2 py-1 text-[11px] text-rose-100"
                              >
                                Remove this news
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </article>

                  {!filteredTextFields.length && !filteredImageSlides.length && !filteredNewsSlides.length ? (
                    <p className="rounded-xl border border-cyan-200/20 bg-[#122b63]/65 px-3 py-2 text-sm text-cyan-100/80">
                      No data found for your search.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {activeSection === 'collections' ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-cyan-200/20 bg-[#122b63]/65 p-3">
                    <h2 className="text-lg font-semibold">Data Files Manager</h2>
                    <p className="mt-1 text-xs text-cyan-100/80">
                      Edit content data directly as JSON, then save to Firebase without redeploying code.
                    </p>

                    <div className="mt-3 rounded-xl border border-cyan-200/20 bg-[#0d2862]/60 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-cyan-100/80">Chatbot Content Source Mode</p>
                        <button
                          type="button"
                          onClick={() => void fetchChatStatus()}
                          disabled={isStatusLoading}
                          className="rounded-lg border border-cyan-200/35 px-2 py-1 text-[11px] text-cyan-100 disabled:opacity-70"
                        >
                          {isStatusLoading ? 'Checking...' : 'Refresh status'}
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {(['auto', 'firebase', 'local'] as ContentMode[]).map((mode) => {
                          const active = (chatStatus?.manualContentMode ?? 'auto') === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => void switchContentMode(mode)}
                              disabled={isSwitchingContentMode}
                              className={`rounded-lg border px-2 py-1 text-[11px] uppercase tracking-[0.08em] transition disabled:opacity-70 ${
                                active
                                  ? 'border-cyan-300/70 bg-cyan-300/20 text-white'
                                  : 'border-cyan-200/30 bg-[#102b66]/60 text-cyan-100/80 hover:border-cyan-200/55'
                              }`}
                            >
                              {mode}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-cyan-100/80">Effective mode: {chatStatus?.contentMode ?? 'unknown'}</span>
                        <span className="text-cyan-100/60">|</span>
                        <span className="text-cyan-100/80">
                          Firebase health: {chatStatus?.firebaseHealth.status ?? 'unknown'}
                        </span>
                        {chatStatus?.firebaseBackoffActive ? (
                          <span className="rounded-md border border-amber-300/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-100">
                            Backoff active
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {(Object.keys(dataCollectionLabels) as EditableDataKey[]).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedDataKey(key)}
                          className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                            selectedDataKey === key
                              ? 'border-cyan-300/70 bg-cyan-300/20 text-white'
                              : 'border-cyan-200/20 bg-[#0d2862]/60 text-cyan-100/85 hover:border-cyan-200/45'
                          }`}
                        >
                          {dataCollectionLabels[key]}
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void loadCollectionJson(selectedDataKey)}
                        disabled={isDataLoading}
                        className="rounded-xl border border-cyan-200/35 bg-[#0d2862]/70 px-3 py-2 text-xs text-cyan-100 disabled:opacity-70"
                      >
                        {isDataLoading ? 'Loading...' : 'Reload from Firebase'}
                      </button>
                      <button
                        type="button"
                        onClick={saveCollectionJson}
                        disabled={isDataSaving}
                        className="rounded-xl bg-cyan-400 px-3 py-2 text-xs font-semibold text-[#04204e] transition hover:bg-cyan-300 disabled:opacity-70"
                      >
                        {isDataSaving ? 'Saving...' : 'Save JSON'}
                      </button>
                      <button
                        type="button"
                        onClick={resetCollectionJson}
                        className="rounded-xl border border-cyan-200/35 bg-[#0d2862]/70 px-3 py-2 text-xs text-cyan-100"
                      >
                        Reset to code defaults
                      </button>
                      <button
                        type="button"
                        onClick={refreshKnowledgeNow}
                        disabled={isRefreshingKnowledge}
                        className="rounded-xl border border-emerald-200/35 bg-[#0f3b3a]/80 px-3 py-2 text-xs text-emerald-100 disabled:opacity-70"
                      >
                        {isRefreshingKnowledge ? 'Refreshing bot...' : 'Refresh chatbot knowledge now'}
                      </button>
                    </div>

                    {useStructuredEditor ? (
                      <div className="mt-3 rounded-xl border border-cyan-200/20 bg-[#0d2862]/60 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-xs text-cyan-100/70">
                            Form editor for {dataCollectionLabels[selectedDataKey]} (auto-syncs to JSON below)
                          </p>
                          {selectedDataKey === 'faqs' ? (
                            <button
                              type="button"
                              onClick={() =>
                                updateArrayCollection('faqs', (items) => [
                                  ...items,
                                  {
                                    id: `faq-${Date.now()}`,
                                    question: 'New question',
                                    answer: 'New answer',
                                  },
                                ], 'FAQ item added.')
                              }
                              className="rounded-lg border border-cyan-200/35 px-2 py-1 text-[11px] text-cyan-100"
                            >
                              Add FAQ
                            </button>
                          ) : null}
                          {selectedDataKey === 'resorts' ? (
                            <button
                              type="button"
                              onClick={() =>
                                updateArrayCollection('resorts', (items) => [
                                  ...items,
                                  {
                                    id: `resort-${Date.now()}`,
                                    name: 'New resort',
                                    location: 'Location',
                                    description: 'Description',
                                    amenities: [],
                                    image: '/images/resort-palawan.jpg',
                                  },
                                ], 'Resort item added.')
                              }
                              className="rounded-lg border border-cyan-200/35 px-2 py-1 text-[11px] text-cyan-100"
                            >
                              Add Resort
                            </button>
                          ) : null}
                          {selectedDataKey === 'services' ? (
                            <button
                              type="button"
                              onClick={() =>
                                updateArrayCollection('services', (items) => [
                                  ...items,
                                  {
                                    id: `service-${Date.now()}`,
                                    title: 'New service',
                                    description: 'Service description',
                                    icon: 'Sparkles',
                                  },
                                ], 'Service item added.')
                              }
                              className="rounded-lg border border-cyan-200/35 px-2 py-1 text-[11px] text-cyan-100"
                            >
                              Add Service
                            </button>
                          ) : null}
                        </div>

                        {collectionHasInvalidJson ? (
                          <p className="rounded-lg border border-rose-300/40 bg-[#3d1f4e]/70 px-2 py-2 text-xs text-rose-100">
                            JSON is invalid. Please fix JSON first before using form editing.
                          </p>
                        ) : null}

                        {selectedDataKey === 'faqs' && Array.isArray(parsedCollection) ? (
                          <div className="space-y-2">
                            {parsedCollection.filter(isObject).map((item, index) => (
                              <article key={`faq-${index}`} className="rounded-xl border border-cyan-200/20 bg-[#102b66]/60 p-2">
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <input
                                    className={fieldClassName}
                                    value={typeof item.id === 'string' ? item.id : ''}
                                    onChange={(event) =>
                                      updateArrayCollection('faqs', (items) =>
                                        items.map((entry, entryIndex) =>
                                          entryIndex === index ? { ...entry, id: event.target.value } : entry
                                        )
                                      , 'FAQ updated.')
                                    }
                                    placeholder="FAQ id"
                                  />
                                  <input
                                    className={fieldClassName}
                                    value={typeof item.question === 'string' ? item.question : ''}
                                    onChange={(event) =>
                                      updateArrayCollection('faqs', (items) =>
                                        items.map((entry, entryIndex) =>
                                          entryIndex === index ? { ...entry, question: event.target.value } : entry
                                        )
                                      , 'FAQ updated.')
                                    }
                                    placeholder="Question"
                                  />
                                </div>
                                <textarea
                                  className={`${fieldClassName} mt-2`}
                                  rows={3}
                                  value={typeof item.answer === 'string' ? item.answer : ''}
                                  onChange={(event) =>
                                    updateArrayCollection('faqs', (items) =>
                                      items.map((entry, entryIndex) =>
                                        entryIndex === index ? { ...entry, answer: event.target.value } : entry
                                      )
                                    , 'FAQ updated.')
                                  }
                                  placeholder="Answer"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateArrayCollection(
                                      'faqs',
                                      (items) => items.filter((_, entryIndex) => entryIndex !== index),
                                      'FAQ removed.'
                                    )
                                  }
                                  className="mt-2 rounded-lg border border-rose-300/40 px-2 py-1 text-[11px] text-rose-100"
                                >
                                  Remove FAQ
                                </button>
                              </article>
                            ))}
                          </div>
                        ) : null}

                        {selectedDataKey === 'resorts' && Array.isArray(parsedCollection) ? (
                          <div className="space-y-2">
                            {parsedCollection.filter(isObject).map((item, index) => {
                              const amenityLines = Array.isArray(item.amenities)
                                ? item.amenities.map((amenity) => String(amenity)).join('\n')
                                : '';

                              return (
                                <article key={`resort-${index}`} className="rounded-xl border border-cyan-200/20 bg-[#102b66]/60 p-2">
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <input
                                      className={fieldClassName}
                                      value={typeof item.id === 'string' ? item.id : ''}
                                      onChange={(event) =>
                                        updateArrayCollection('resorts', (items) =>
                                          items.map((entry, entryIndex) =>
                                            entryIndex === index ? { ...entry, id: event.target.value } : entry
                                          )
                                        , 'Resort updated.')
                                      }
                                      placeholder="Resort id"
                                    />
                                    <input
                                      className={fieldClassName}
                                      value={typeof item.name === 'string' ? item.name : ''}
                                      onChange={(event) =>
                                        updateArrayCollection('resorts', (items) =>
                                          items.map((entry, entryIndex) =>
                                            entryIndex === index ? { ...entry, name: event.target.value } : entry
                                          )
                                        , 'Resort updated.')
                                      }
                                      placeholder="Resort name"
                                    />
                                    <input
                                      className={fieldClassName}
                                      value={typeof item.location === 'string' ? item.location : ''}
                                      onChange={(event) =>
                                        updateArrayCollection('resorts', (items) =>
                                          items.map((entry, entryIndex) =>
                                            entryIndex === index ? { ...entry, location: event.target.value } : entry
                                          )
                                        , 'Resort updated.')
                                      }
                                      placeholder="Location"
                                    />
                                    <input
                                      className={fieldClassName}
                                      value={typeof item.image === 'string' ? item.image : ''}
                                      onChange={(event) =>
                                        updateArrayCollection('resorts', (items) =>
                                          items.map((entry, entryIndex) =>
                                            entryIndex === index ? { ...entry, image: event.target.value } : entry
                                          )
                                        , 'Resort updated.')
                                      }
                                      placeholder="Image path"
                                    />
                                  </div>
                                  <textarea
                                    className={`${fieldClassName} mt-2`}
                                    rows={3}
                                    value={typeof item.description === 'string' ? item.description : ''}
                                    onChange={(event) =>
                                      updateArrayCollection('resorts', (items) =>
                                        items.map((entry, entryIndex) =>
                                          entryIndex === index ? { ...entry, description: event.target.value } : entry
                                        )
                                      , 'Resort updated.')
                                    }
                                    placeholder="Description"
                                  />
                                  <textarea
                                    className={`${fieldClassName} mt-2`}
                                    rows={4}
                                    value={amenityLines}
                                    onChange={(event) =>
                                      updateArrayCollection('resorts', (items) =>
                                        items.map((entry, entryIndex) =>
                                          entryIndex === index
                                            ? {
                                                ...entry,
                                                amenities: event.target.value
                                                  .split('\n')
                                                  .map((line) => line.trim())
                                                  .filter((line) => line.length > 0),
                                              }
                                            : entry
                                        )
                                      , 'Resort updated.')
                                    }
                                    placeholder="Amenities (one per line)"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateArrayCollection(
                                        'resorts',
                                        (items) => items.filter((_, entryIndex) => entryIndex !== index),
                                        'Resort removed.'
                                      )
                                    }
                                    className="mt-2 rounded-lg border border-rose-300/40 px-2 py-1 text-[11px] text-rose-100"
                                  >
                                    Remove Resort
                                  </button>
                                </article>
                              );
                            })}
                          </div>
                        ) : null}

                        {selectedDataKey === 'services' && Array.isArray(parsedCollection) ? (
                          <div className="space-y-2">
                            {parsedCollection.filter(isObject).map((item, index) => (
                              <article key={`service-${index}`} className="rounded-xl border border-cyan-200/20 bg-[#102b66]/60 p-2">
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <input
                                    className={fieldClassName}
                                    value={typeof item.id === 'string' ? item.id : ''}
                                    onChange={(event) =>
                                      updateArrayCollection('services', (items) =>
                                        items.map((entry, entryIndex) =>
                                          entryIndex === index ? { ...entry, id: event.target.value } : entry
                                        )
                                      , 'Service updated.')
                                    }
                                    placeholder="Service id"
                                  />
                                  <input
                                    className={fieldClassName}
                                    value={typeof item.title === 'string' ? item.title : ''}
                                    onChange={(event) =>
                                      updateArrayCollection('services', (items) =>
                                        items.map((entry, entryIndex) =>
                                          entryIndex === index ? { ...entry, title: event.target.value } : entry
                                        )
                                      , 'Service updated.')
                                    }
                                    placeholder="Service title"
                                  />
                                  <input
                                    className={fieldClassName}
                                    value={typeof item.icon === 'string' ? item.icon : ''}
                                    onChange={(event) =>
                                      updateArrayCollection('services', (items) =>
                                        items.map((entry, entryIndex) =>
                                          entryIndex === index ? { ...entry, icon: event.target.value } : entry
                                        )
                                      , 'Service updated.')
                                    }
                                    placeholder="Icon name"
                                  />
                                </div>
                                <textarea
                                  className={`${fieldClassName} mt-2`}
                                  rows={3}
                                  value={typeof item.description === 'string' ? item.description : ''}
                                  onChange={(event) =>
                                    updateArrayCollection('services', (items) =>
                                      items.map((entry, entryIndex) =>
                                        entryIndex === index ? { ...entry, description: event.target.value } : entry
                                      )
                                    , 'Service updated.')
                                  }
                                  placeholder="Service description"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateArrayCollection(
                                      'services',
                                      (items) => items.filter((_, entryIndex) => entryIndex !== index),
                                      'Service removed.'
                                    )
                                  }
                                  className="mt-2 rounded-lg border border-rose-300/40 px-2 py-1 text-[11px] text-rose-100"
                                >
                                  Remove Service
                                </button>
                              </article>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-3 rounded-xl border border-cyan-200/20 bg-[#0d2862]/60 p-2">
                      <p className="mb-2 text-xs text-cyan-100/70">
                        Editing: {dataCollectionLabels[selectedDataKey]}
                      </p>
                      <textarea
                        className={`${fieldClassName} min-h-[380px] font-mono text-xs`}
                        value={dataJson}
                        onChange={(event) => setDataJson(event.target.value)}
                        placeholder="JSON data will appear here..."
                        spellCheck={false}
                      />
                    </div>

                    {dataStatus ? (
                      <p className="mt-3 rounded-xl border border-cyan-200/30 bg-[#152f6c]/70 px-3 py-2 text-xs text-cyan-100/90">
                        {dataStatus}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {activeSection === 'profile' ? (
                <div className="mt-4 space-y-3">
                  <h2 className="text-lg font-semibold">Admin Profile</h2>
                  <div className="grid gap-3 lg:grid-cols-[120px_1fr]">
                    <div className="flex items-center justify-center">
                      <div className="h-24 w-24 overflow-hidden rounded-full border border-cyan-200/40 bg-[#0d2862]/60">
                        {profile.photoUrl ? (
                          <img src={profile.photoUrl} alt="Admin avatar" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-cyan-100/75">
                            {(profile.displayName || user?.email || 'A').slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <input
                        className={fieldClassName}
                        value={profile.displayName}
                        onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))}
                        placeholder="Admin name"
                      />
                      <input
                        className={fieldClassName}
                        value={profile.idNumber}
                        onChange={(event) => setProfile((current) => ({ ...current, idNumber: event.target.value }))}
                        placeholder="ID number"
                      />
                      <input
                        className={fieldClassName}
                        value={profile.photoUrl}
                        onChange={(event) => setProfile((current) => ({ ...current, photoUrl: event.target.value }))}
                        placeholder="Profile image URL"
                      />

                      <button
                        type="button"
                        onClick={saveProfile}
                        disabled={isSavingProfile}
                        className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#04204e] transition hover:bg-cyan-300 disabled:opacity-70"
                      >
                        {isSavingProfile ? 'Saving profile...' : 'Save profile'}
                      </button>
                    </div>
                  </div>

                  {profileStatus ? (
                    <p className="rounded-xl border border-cyan-200/30 bg-[#152f6c]/70 px-3 py-2 text-xs text-cyan-100/90">
                      {profileStatus}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
