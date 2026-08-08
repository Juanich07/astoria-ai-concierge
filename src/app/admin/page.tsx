"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { defaultLandingContent, normalizeLandingPageContent, type LandingPageContent } from '@/data/landingContent';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  FileText,
  Gauge,
  LayoutGrid,
  Lock,
  Newspaper,
  RefreshCcw,
  Save,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  User,
  Zap,
} from 'lucide-react';
import { faqs } from '@/data/faqs';
import { resorts } from '@/data/resorts';
import { services } from '@/data/services';
import { suggestedQuestions } from '@/data/suggestedQuestions';
import { testimonials } from '@/data/testimonials';
import { chatResponses } from '@/data/chatResponses';
import { tourPackages, sharedGroupTours, tourContact } from '@/data/tours';
import { intentKnowledgeSections, extendedKnowledge } from '@/data/extendedKnowledge';
import { defaultSettings, type HotelSettings } from '@/data/settings';
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
  | 'knowledge'
  | 'settings';

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
  'w-full rounded-xl border border-emerald-300/20 bg-[#0b2d23]/60 px-3 py-2 text-sm text-white outline-none placeholder:text-emerald-200/40 focus:border-emerald-300/60';

const sections: Array<{ id: SectionId; label: string; hint: string }> = [
  { id: 'overview', label: 'Dashboard', hint: 'Date, time, metrics' },
  { id: 'carousel', label: 'Edit Carousel', hint: 'Add and update slides' },
  { id: 'news', label: 'Edit News', hint: 'Manage news cards' },
  { id: 'data', label: 'Add / Remove Data', hint: 'Search and edit everything' },
  { id: 'collections', label: 'Data Files', hint: 'Edit resorts, faqs, tours, and more' },
  { id: 'profile', label: 'Admin Profile', hint: 'Picture, name, ID' },
];

const sectionIcons: Record<SectionId, LucideIcon> = {
  overview: Gauge,
  carousel: LayoutGrid,
  news: Newspaper,
  data: Database,
  collections: FileText,
  profile: User,
};

const dataCollectionLabels: Record<EditableDataKey, string> = {
  faqs: 'FAQs',
  resorts: 'Resorts',
  services: 'Services',
  suggestedQuestions: 'Suggested Questions',
  testimonials: 'Testimonials',
  tours: 'Tours',
  chatResponses: 'Chat Responses',
  knowledge: 'Knowledge Sections',
  settings: 'Hotel Settings',
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toPrettyJson = (value: unknown) => JSON.stringify(value, null, 2);

const getReadableFirestoreError = (error: unknown, fallback: string) => {
  const code =
    typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : '';

  if (code === 'permission-denied') {
    return 'Missing or insufficient Firestore permissions for admin access. Update your Firestore rules for admins/{uid}, admin/{uid}, and siteContent/landingPage.';
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
};

const getReadableAuthError = (error: unknown, fallback: string) => {
  const code =
    typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : '';

  if (code === 'auth/invalid-credential') {
    return 'Invalid email or password. Check credentials and try again.';
  }

  if (code === 'auth/user-not-found') {
    return 'No account found for that email in this Firebase project.';
  }

  if (code === 'auth/wrong-password') {
    return 'Incorrect password. Try again or reset the password in Firebase Auth.';
  }

  if (code === 'auth/invalid-email') {
    return 'Email format is invalid. Please enter a valid email address.';
  }

  if (code === 'auth/too-many-requests') {
    return 'Too many login attempts. Wait a few minutes, then try again.';
  }

  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password login is disabled in Firebase Authentication. Enable it in Sign-in method.';
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
};

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
    case 'settings':
      return defaultSettings;
    default:
      return {};
  }
};

const getCollectionRef = (key: EditableDataKey) => {
  if (key === 'chatResponses' || key === 'knowledge' || key === 'settings') {
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
    case 'settings': {
      const defaults = defaultSettings;
      const merged: Partial<HotelSettings> = {};

      for (const [key, value] of Object.entries(defaults)) {
        const rawValue = raw[key];
        if (typeof rawValue === typeof value && rawValue !== null) {
          merged[key as keyof HotelSettings] = rawValue as any;
        } else {
          merged[key as keyof HotelSettings] = value;
        }
      }

      return merged as HotelSettings;
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
    case 'settings':
      return isObject(payload) ? null : 'Expected a JSON object for hotel settings.';
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
    case 'settings':
      return {
        ...(payload as Record<string, unknown>),
        ...baseMeta,
      };
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

      try {
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
      } catch (error) {
        setIsAdmin(false);
        setContentStatus(getReadableFirestoreError(error, 'Unable to load admin data.'));
      } finally {
        setIsLoading(false);
      }
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

  const refreshChatbotKnowledge = async () => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refreshKnowledge' }),
    });

    if (!response.ok) {
      const fallback = await response.text();
      throw new Error(fallback || 'Knowledge refresh failed.');
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
      await refreshChatbotKnowledge();
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

  const collectionHasInvalidJson = dataJson.trim().length > 0 && parsedCollection === null;

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
    if (!auth) {
      setContentStatus('Firebase Authentication is not configured. Check NEXT_PUBLIC_FIREBASE_* environment values.');
      return;
    }

    try {
      setContentStatus('');
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      setContentStatus(getReadableAuthError(error, 'Sign-in failed.'));
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
      await refreshChatbotKnowledge();
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
    { label: 'No-signup users', value: noSignupUsers, detail: 'Tracks admin-side activity', icon: User },
    { label: 'Carousel slides', value: form.imageSlides.length, detail: 'Slides shown on the homepage', icon: LayoutGrid },
    { label: 'News cards', value: form.newsSlides.length, detail: 'Active news updates', icon: Newspaper },
    { label: 'Session edits', value: sessionEdits, detail: 'Changes made in this session', icon: Zap },
  ];

  if (!isFirebaseConfigured) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#07150f] via-[#0c271f] to-[#123a2f] px-4 py-10 text-white">
        <div className="mx-auto max-w-xl rounded-[36px] border border-emerald-300/20 bg-[#0c2b1f]/85 p-6 shadow-2xl shadow-emerald-900/20 backdrop-blur">
          <h1 className="text-3xl font-semibold text-emerald-100">Admin Dashboard</h1>
          <p className="mt-3 text-sm text-emerald-200/80">
            Firebase environment values are missing. Add your NEXT_PUBLIC_FIREBASE variables to enable login and editing.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-6 text-slate-900 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-7xl">
        {!user ? (
          <section className="mx-auto mt-10 w-full max-w-md rounded-[32px] border border-emerald-300/20 bg-[#0c2b1f]/80 p-6 shadow-2xl shadow-emerald-900/25 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-500/15 text-emerald-100 shadow-inner shadow-black/20">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-emerald-100">Admin Login</h1>
                <p className="mt-1 text-sm text-emerald-200/80">Secure access to resort content and admin data.</p>
              </div>
            </div>
            <form onSubmit={login} className="mt-6 space-y-4">
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
                className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                Sign in
              </button>
            </form>
            {contentStatus ? (
              <p className="mt-4 rounded-2xl border border-emerald-200/25 bg-[#0c3b22]/80 px-3 py-2 text-xs text-emerald-100/90">
                {contentStatus}
              </p>
            ) : null}
          </section>
        ) : null}

        {user && !isAdmin && !isLoading ? (
          <section className="mx-auto mt-10 w-full max-w-2xl rounded-[32px] border border-emerald-200/20 bg-[#092315]/85 p-6 shadow-lg shadow-emerald-900/20">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-rose-500/10 text-rose-300">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-emerald-100">Access denied</h2>
                <p className="mt-1 text-sm text-emerald-200/80">
                  Your user is signed in but not active for admin access.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-[#0d3f28]/80 p-4 text-sm text-emerald-100">
              Add this user UID into Firestore as active: <code className="rounded bg-[#0b3a1f]/80 px-1 py-0.5 text-emerald-200">admins/{user.uid}</code> or <code className="rounded bg-[#0b3a1f]/80 px-1 py-0.5 text-emerald-200">admin/{user.uid}</code>.
            </div>
            <button
              type="button"
              onClick={() => auth && signOut(auth)}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-emerald-200/20 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 transition hover:bg-emerald-500/25"
            >
              <ArrowRight className="h-4 w-4" />
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
              className={`fixed inset-y-0 left-0 z-40 w-[86vw] max-w-[320px] overflow-y-auto border-r border-slate-200/80 bg-violet-950/95 p-3 backdrop-blur transition-transform duration-200 lg:static lg:w-auto lg:max-w-none lg:rounded-3xl lg:border lg:bg-violet-950/90 ${
                isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
              }`}
            >
              <div className="rounded-[28px] border border-white/10 bg-white/10 p-4 shadow-2xl shadow-slate-950/10 backdrop-blur-lg">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-white/10 text-white shadow-inner shadow-black/10">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-200">Astoria Admin</p>
                    <p className="mt-1 text-sm text-white/90">{user.email ?? 'Signed in admin'}</p>
                  </div>
                </div>
              </div>

              <nav className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {sections.map((section) => {
                  const Icon = sectionIcons[section.id];
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => {
                        setActiveSection(section.id);
                        setIsSidebarOpen(false);
                      }}
                      className={`group flex items-center gap-3 rounded-3xl border px-4 py-3 text-left transition ${
                        activeSection === section.id
                          ? 'border-white/20 bg-white text-slate-900 shadow-[0_12px_28px_rgba(15,23,42,0.12)]'
                          : 'border-transparent bg-violet-900/80 text-white/90 hover:border-white/10 hover:bg-violet-900'
                      }`}
                    >
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-100 transition group-hover:bg-emerald-500/20">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{section.label}</p>
                        <p className="text-xs text-emerald-200/70">{section.hint}</p>
                      </div>
                    </button>
                  );
                })}
              </nav>

              <div className="mt-3 grid gap-3">
                <button
                  type="button"
                  onClick={saveContent}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-70"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save all changes'}
                </button>
                <button
                  type="button"
                  onClick={seedAllDataToFirebase}
                  disabled={isSeeding}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200/35 bg-[#0c3d23]/75 px-4 py-3 text-sm text-emerald-100 transition hover:border-emerald-300/60 disabled:opacity-70"
                >
                  <UploadCloud className="h-4 w-4" />
                  {isSeeding ? 'Uploading all data...' : 'Upload all data to Firebase'}
                </button>
                <button
                  type="button"
                  onClick={() => auth && signOut(auth)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200/25 bg-[#0c3921]/80 px-4 py-3 text-sm text-emerald-100 transition hover:bg-[#0d4d2d]/95"
                >
                  <ArrowRight className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </aside>

            <section className="rounded-3xl border border-slate-200/70 bg-slate-50 p-4 shadow-sm sm:p-5 lg:p-6">
              <div className="mb-3 lg:hidden">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-300/70 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-400"
                >
                  <span className="inline-flex h-3.5 w-4 flex-col justify-between" aria-hidden="true">
                    <span className="block h-[2px] w-full rounded-full bg-slate-700" />
                    <span className="block h-[2px] w-full rounded-full bg-slate-700" />
                    <span className="block h-[2px] w-full rounded-full bg-slate-700" />
                  </span>
                  Menu
                </button>
              </div>

              <header className="mb-4 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Admin Control Center</p>
                  <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">Material Admin Dashboard</h1>
                  <p className="mt-1 text-sm text-slate-500">
                    {now.toLocaleDateString()} • {now.toLocaleTimeString()}
                  </p>
                </div>
                <div className="grid gap-2 sm:auto-cols-max sm:grid-flow-col">
                  <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
                    Live metrics update as you edit data
                  </div>
                  <button
                    type="button"
                    onClick={saveContent}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-2xl bg-violet-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-70"
                  >
                    <Save className="h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </button>
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
                    {metrics.map((metric) => {
                    const Icon = metric.icon;
                    return (
                      <article key={metric.label} className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
                            <p className="mt-4 text-3xl font-semibold text-slate-900">{metric.value}</p>
                          </div>
                          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                            <Icon className="h-5 w-5" />
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-slate-500">{metric.detail}</p>
                      </article>
                    );
                  })}
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <article className="rounded-[28px] border border-slate-200/70 bg-white p-4 shadow-sm">
                      <h2 className="text-base font-semibold text-slate-900">Carousel Preview</h2>
                      <ul className="mt-3 space-y-2">
                        {form.imageSlides.slice(0, 4).map((slide, index) => (
                          <li key={`${slide.title}-${index}`} className="rounded-xl border border-cyan-200/20 bg-[#0d2862]/60 p-2">
                            <p className="text-sm font-medium text-cyan-50">{slide.title}</p>
                            <p className="text-xs text-cyan-100/75">{slide.subtitle}</p>
                          </li>
                        ))}
                      </ul>
                    </article>

                    <article className="rounded-[28px] border border-slate-200/70 bg-white p-4 shadow-sm">
                      <h2 className="text-base font-semibold text-slate-900">News Preview</h2>
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

                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2 rounded-xl border border-cyan-200/20 bg-[#132d68]/50 px-3 py-2">
                        <span className="text-lg">✏️</span>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-cyan-100">Edit {dataCollectionLabels[selectedDataKey]}</p>
                          <p className="text-[10px] text-cyan-100/70">Make changes below and click "💾 Save" to update Firebase</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void loadCollectionJson(selectedDataKey)}
                          disabled={isDataLoading}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200/35 bg-[#0d2862]/70 px-3 py-2 text-xs text-cyan-100 transition hover:border-cyan-200/60 disabled:opacity-70"
                        >
                          <span className="text-sm">🔄</span>
                          {isDataLoading ? 'Loading...' : 'Reload from Firebase'}
                        </button>
                        <button
                          type="button"
                          onClick={saveCollectionJson}
                          disabled={isDataSaving}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-3 py-2 text-xs font-semibold text-[#04204e] transition hover:bg-cyan-300 disabled:opacity-70"
                        >
                          <span className="text-sm">💾</span>
                          {isDataSaving ? 'Saving...' : 'Save to Firebase'}
                        </button>
                        <button
                          type="button"
                          onClick={resetCollectionJson}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200/35 bg-[#0d2862]/70 px-3 py-2 text-xs text-cyan-100 transition hover:border-cyan-200/60"
                        >
                          <span className="text-sm">↺</span>
                          Reset to defaults
                        </button>
                        <button
                          type="button"
                          onClick={refreshKnowledgeNow}
                          disabled={isRefreshingKnowledge}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200/35 bg-[#0f3b3a]/80 px-3 py-2 text-xs text-emerald-100 transition hover:border-emerald-200/60 disabled:opacity-70"
                        >
                          <span className="text-sm">🤖</span>
                          {isRefreshingKnowledge ? 'Refreshing bot...' : 'Refresh chatbot'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-cyan-200/20 bg-[#0d2862]/60 p-2">
                      <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-cyan-200/30 bg-[#0f2a5a]/70 px-2.5 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📝</span>
                          <div>
                            <p className="text-xs font-semibold text-cyan-50">{dataCollectionLabels[selectedDataKey]} JSON</p>
                            <p className="text-[10px] text-cyan-100/70">Edit the values directly</p>
                          </div>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${collectionHasInvalidJson ? 'bg-rose-500/30 text-rose-100' : 'bg-emerald-500/30 text-emerald-100'}`}>
                          {collectionHasInvalidJson ? '❌ Invalid JSON' : '✓ Valid'}
                        </span>
                      </div>
                      <textarea
                        className={`${fieldClassName} min-h-[380px] font-mono text-xs`}
                        value={dataJson}
                        onChange={(event) => setDataJson(event.target.value)}
                        placeholder="JSON data will appear here..."
                        spellCheck={false}
                      />
                      {(selectedDataKey === 'faqs' || selectedDataKey === 'chatResponses') ? (
                        <p className="mt-2 rounded-lg border border-amber-300/35 bg-[#47361a]/65 px-2 py-1.5 text-[11px] text-amber-100/90">
                          Tip: update check-in/check-out and operational times in Hotel Settings for the chatbot to use the latest values.
                        </p>
                      ) : null}
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
