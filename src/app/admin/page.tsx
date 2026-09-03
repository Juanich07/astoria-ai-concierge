"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User as FirebaseUser } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { defaultLandingContent, normalizeLandingPageContent, type LandingPageContent } from '@/data/landingContent';
import AdminHeaderBar from '@/components/admin/AdminHeaderBar';
import CarouselEditorSection from '@/components/admin/CarouselEditorSection';
import CollectionsEditorSection from '@/components/admin/CollectionsEditorSection';
import AnnouncementsSection from '@/components/admin/AnnouncementsSection';
import NewsEditorSection from '@/components/admin/NewsEditorSection';
import type { ActivityLogEntry, ChatStatus, ContentMode, DailyHealthSnapshot, EditableDataKey } from '@/types/admin';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  FileText,
  Gauge,
  LayoutGrid,
  Lock,
  Megaphone,
  Newspaper,
  Save,
  ShieldCheck,
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

type SectionId = 'overview' | 'health' | 'carousel' | 'news' | 'data' | 'collections' | 'announcements' | 'profile';
type TextFieldKey = Exclude<keyof LandingPageContent, 'imageSlides' | 'newsSlides'>;

type AdminProfile = {
  displayName: string;
  idNumber: string;
  photoUrl: string;
};

const fieldClassName =
  'w-full rounded-xl border border-emerald-300/20 bg-[#0b2d23]/60 px-3 py-2 text-sm text-white outline-none placeholder:text-emerald-200/40 focus:border-emerald-300/60';

const sections: Array<{ id: SectionId; label: string; hint: string }> = [
  { id: 'overview', label: 'Dashboard', hint: 'Date, time, metrics' },
  { id: 'health', label: 'Service Health', hint: 'Daily system metrics' },
  { id: 'carousel', label: 'Edit Carousel', hint: 'Add and update slides' },
  { id: 'news', label: 'Edit News', hint: 'Manage news cards' },
  { id: 'data', label: 'Add / Remove Data', hint: 'Search and edit everything' },
  { id: 'collections', label: 'Data Files', hint: 'Edit resorts, faqs, tours, and more' },
  { id: 'announcements', label: 'Announcements', hint: 'New events, buildings, notices' },
  { id: 'profile', label: 'Admin Profile', hint: 'Picture, name, ID' },
];

const sectionIcons: Record<SectionId, LucideIcon> = {
  overview: Gauge,
  health: ShieldCheck,
  carousel: LayoutGrid,
  news: Newspaper,
  data: Database,
  collections: FileText,
  announcements: Megaphone,
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
      const merged: Partial<HotelSettings> = { ...defaults };

      for (const [key, value] of Object.entries(defaults)) {
        const rawValue = raw[key];
        const typedKey = key as keyof HotelSettings;

        if (rawValue === undefined || rawValue === null) {
          continue;
        }

        if (typedKey === 'frontDeskLocations' && Array.isArray(rawValue)) {
          merged.frontDeskLocations = rawValue as string[];
          continue;
        }

        if (typedKey === 'wifiDeviceLimit' && typeof rawValue === 'number') {
          merged.wifiDeviceLimit = rawValue;
          continue;
        }

        if (typeof rawValue === typeof value) {
          (merged as Record<string, unknown>)[typedKey] = rawValue as HotelSettings[keyof HotelSettings];
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
  const [user, setUser] = useState<FirebaseUser | null>(null);
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
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [previewNewsIndex, setPreviewNewsIndex] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(true);
  const [editingNewsIndex, setEditingNewsIndex] = useState<number | null>(null);
  const [editingSlideIndex, setEditingSlideIndex] = useState<number | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [seenActivityCount, setSeenActivityCount] = useState(0);
  const [dailyHealthSnapshots, setDailyHealthSnapshots] = useState<DailyHealthSnapshot[]>([]);
  const [profile, setProfile] = useState<AdminProfile>({
    displayName: '',
    idNumber: '',
    photoUrl: '',
  });

  const pushActivityLog = (action: string, details: string) => {
    const actor = user?.email || user?.uid || 'Unknown admin';
    setActivityLogs((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: new Date().toLocaleString(),
        userLabel: actor,
        action,
        details,
      },
      ...current,
    ].slice(0, 50));
  };

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isPreviewPlaying) return;

    const imageCount = Math.max(form.imageSlides.length, 1);
    const newsCount = Math.max(form.newsSlides.length, 1);

    const timer = window.setInterval(() => {
      setPreviewImageIndex((current) => (current + 1) % imageCount);
      setPreviewNewsIndex((current) => (current + 1) % newsCount);
    }, 3200);

    return () => window.clearInterval(timer);
  }, [isPreviewPlaying, form.imageSlides.length, form.newsSlides.length]);

  useEffect(() => {
    if (!auth || !db || !isFirebaseConfigured) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth!, async (nextUser) => {
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
          getDoc(doc(db!, 'admins', nextUser.uid)),
          getDoc(doc(db!, 'admin', nextUser.uid)),
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

          const contentSnap = await getDoc(doc(db!, 'siteContent', 'landingPage'));
          if (contentSnap.exists()) {
            const normalizedContent = normalizeLandingPageContent(contentSnap.data());
            setForm(normalizedContent);
            window.localStorage.setItem('astoria-landing-page-content', JSON.stringify(normalizedContent));
          } else {
            setForm(defaultLandingContent);
            window.localStorage.setItem('astoria-landing-page-content', JSON.stringify(defaultLandingContent));
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
      const snapshot = await getDoc(doc(db!, ref.collectionName, ref.docId));
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

      await setDoc(doc(db!, ref.collectionName, ref.docId), payload, { merge: true });
      await refreshChatbotKnowledge();
      setDataStatus(`${dataCollectionLabels[selectedDataKey]} saved successfully.`);
      pushActivityLog('Saved data file', `${dataCollectionLabels[selectedDataKey]} JSON updated in Firebase.`);
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
  const healthAlertCount = [
    chatStatus?.firebaseHealth.status === 'unhealthy',
    chatStatus?.firebaseBackoffActive,
    chatStatus?.groqHealth?.status === 'unhealthy',
    (chatStatus?.usage?.rateLimitHitsLastMinute ?? 0) > 0,
  ].filter(Boolean).length;
  const hasHealthAlert = healthAlertCount > 0;
  const unreadActivityCount = Math.max(activityLogs.length - seenActivityCount, 0);

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
      pushActivityLog('Refreshed chatbot', 'Knowledge cache was refreshed from admin panel.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Knowledge refresh failed.';
      setDataStatus(message);
    } finally {
      setIsRefreshingKnowledge(false);
    }
  };

  const saveDailyHealthSnapshot = async (status: ChatStatus | null) => {
    if (!db || !user || !isAdmin || !status) return;

    try {
      const today = new Date();
      const dateKey = today.toISOString().slice(0, 10);
      const apiRequests = Math.max(0, status.usage.requestsLastMinute ?? 0);
      const firebaseRequests = Math.max(0, Math.round(apiRequests * 0.45));
      const snapshot: DailyHealthSnapshot = {
        id: `health-${dateKey}`,
        dateKey,
        label: today.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        firebaseStatus: status.firebaseHealth.status,
        groqStatus: status.groqHealth.status,
        provider: status.usage.provider,
        apiRequests,
        firebaseRequests,
        requests: apiRequests,
        errors: status.usage.errorsLastMinute,
        rateLimitHits: status.usage.rateLimitHitsLastMinute,
        backoffActive: status.firebaseBackoffActive,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db!, 'adminMetrics', `health-${dateKey}`), { ...snapshot, updatedAt: serverTimestamp() }, { merge: true });
    } catch {
      // Silently skip persistence failures so the dashboard remains usable.
    }
  };

  const loadDailyHealthSnapshots = async () => {
    if (!db || !user || !isAdmin) return;

    try {
      const querySnapshot = await getDocs(collection(db!, 'adminMetrics'));
      const snapshots = querySnapshot.docs
        .map((item) => item.data() as Partial<DailyHealthSnapshot>)
        .filter((item): item is DailyHealthSnapshot => !!item.dateKey)
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
        .slice(0, 7);

      setDailyHealthSnapshots(snapshots);
    } catch {
      setDailyHealthSnapshots([]);
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
      if (user && isAdmin) {
        void saveDailyHealthSnapshot(payload);
      }
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
      pushActivityLog('Switched content mode', `Changed chatbot content mode to ${mode}.`);
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
    void loadDailyHealthSnapshots();

    const timer = window.setInterval(() => {
      void fetchChatStatus(true);
      void loadDailyHealthSnapshots();
    }, 20000);

    return () => window.clearInterval(timer);
  }, [canRenderForm, user, isAdmin]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth) {
      setContentStatus('Firebase Authentication is not configured. Check NEXT_PUBLIC_FIREBASE_* environment values.');
      return;
    }

    try {
      setContentStatus('');
      await signInWithEmailAndPassword(auth!, email.trim(), password);
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
        doc(db!, 'siteContent', 'landingPage'),
        {
          ...payload,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      setForm(payload);
      window.localStorage.setItem('astoria-landing-page-content', JSON.stringify(payload));
      setContentStatus('Changes saved successfully.');
      pushActivityLog('Saved landing content', 'Landing page content was saved to Firebase.');
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
        doc(db!, adminCollection, user.uid),
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
      pushActivityLog('Updated profile', 'Admin profile details were updated.');
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
      const batch = writeBatch(db!);

      batch.set(
        doc(db!, 'siteContent', 'landingPage'),
        {
          ...normalizedLanding,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      batch.set(
        doc(db!, 'siteContent', 'chatResponses'),
        {
          ...chatResponses,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      batch.set(
        doc(db!, 'siteContent', 'knowledge'),
        {
          intentSections: intentKnowledgeSections,
          fullText: extendedKnowledge,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      batch.set(
        doc(db!, 'contentData', 'faqs'),
        {
          items: faqs,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      batch.set(
        doc(db!, 'contentData', 'resorts'),
        {
          items: resorts,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      batch.set(
        doc(db!, 'contentData', 'services'),
        {
          items: services,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      batch.set(
        doc(db!, 'contentData', 'tours'),
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
        doc(db!, 'contentData', 'suggestedQuestions'),
        {
          items: suggestedQuestions,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      batch.set(
        doc(db!, 'contentData', 'testimonials'),
        {
          items: testimonials,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      batch.set(
        doc(db!, 'seedData', 'meta'),
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
      window.localStorage.setItem('astoria-landing-page-content', JSON.stringify(normalizedLanding));
      setContentStatus('All data has been uploaded to Firebase successfully.');
      pushActivityLog('Uploaded all data', 'Seeded all configured content files to Firebase.');
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
      const imageRef = storageRef(storage!, `admin/carousel/${user.uid}/${uniqueName}`);

      await uploadBytes(imageRef, file);
      const imageUrl = await getDownloadURL(imageRef);

      updateImageSlide(index, 'imageUrl', imageUrl);
      setContentStatus('Image uploaded. Save all changes to publish this slide update.');
      pushActivityLog('Uploaded carousel image', `Updated image for carousel slide ${index + 1}.`);
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

  const metrics = [
    { label: 'No-signup users', value: noSignupUsers, detail: 'Tracks admin-side activity', icon: User },
    { label: 'Carousel slides', value: form.imageSlides.length, detail: 'Slides shown on the homepage', icon: LayoutGrid },
    { label: 'News cards', value: form.newsSlides.length, detail: 'Active news updates', icon: Newspaper },
    { label: 'Session edits', value: sessionEdits, detail: 'Changes made in this session', icon: Zap },
  ];

  const chartSeries = dailyHealthSnapshots.length
    ? [...dailyHealthSnapshots].reverse().map((snapshot) => ({
        label: snapshot.label,
        api: Number(snapshot.apiRequests ?? snapshot.requests ?? 0),
        firebase: Number(snapshot.firebaseRequests ?? 0),
      }))
    : [
        { label: 'Mon', api: 22, firebase: 12 },
        { label: 'Tue', api: 28, firebase: 14 },
        { label: 'Wed', api: 26, firebase: 15 },
        { label: 'Thu', api: 32, firebase: 17 },
        { label: 'Fri', api: 30, firebase: 16 },
        { label: 'Sat', api: 36, firebase: 19 },
        { label: 'Sun', api: 34, firebase: 18 },
      ];

  const chartMax = Math.max(...chartSeries.flatMap((point) => [point.api, point.firebase]), 1);
  const apiChartPoints = chartSeries
    .map((point, index) => {
      const x = (index / Math.max(chartSeries.length - 1, 1)) * 260;
      const y = 92 - (point.api / chartMax) * 72;
      return `${x},${y}`;
    })
    .join(' ');
  const firebaseChartPoints = chartSeries
    .map((point, index) => {
      const x = (index / Math.max(chartSeries.length - 1, 1)) * 260;
      const y = 92 - (point.firebase / chartMax) * 72;
      return `${x},${y}`;
    })
    .join(' ');

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
              className={`fixed inset-y-0 left-0 z-40 w-[86vw] max-w-[320px] overflow-y-auto border-r border-emerald-200/20 bg-[#0b3129]/95 p-3 backdrop-blur transition-transform duration-200 lg:static lg:w-auto lg:max-w-none lg:rounded-3xl lg:border lg:bg-[#0b3129]/90 ${
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
                    <p className="mt-1 text-sm text-white/90">{user?.email ?? 'Signed in admin'}</p>
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
                      className={`group flex items-center gap-3 rounded-[14px] border px-3 py-3 text-left transition ${
                        activeSection === section.id
                          ? 'border-white/20 bg-white text-slate-900 shadow-[0_12px_28px_rgba(15,23,42,0.12)]'
                          : 'border-transparent bg-emerald-900/60 text-white/90 hover:border-white/10 hover:bg-emerald-800/80'
                      }`}
                    >
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-emerald-500/10 text-emerald-100 transition group-hover:bg-emerald-500/20">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[13px] font-semibold leading-tight">{section.label}</p>
                        <p className="mt-0.5 text-[11px] leading-snug text-emerald-200/70">{section.hint}</p>
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

              <AdminHeaderBar
                now={now}
                isSaving={isSaving}
                hasHealthAlert={hasHealthAlert}
                healthAlertCount={healthAlertCount}
                unreadActivityCount={unreadActivityCount}
                chatStatus={chatStatus}
                activityLogs={activityLogs}
                onSaveContent={saveContent}
                onMarkLogsSeen={() => setSeenActivityCount(activityLogs.length)}
              />

              {contentStatus ? (
                <p className="mt-3 rounded-xl border border-cyan-200/30 bg-[#152f6c]/70 px-3 py-2 text-xs text-cyan-100/90">
                  {contentStatus}
                </p>
              ) : null}

              {activeSection === 'overview' ? (
                <div className="mt-4 space-y-3">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <article className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">Service Health</h3>
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Live</span>
                      </div>

                      <div className="mb-3 flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Healthy</span>
                        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Warn</span>
                        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />Issue</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Firebase', value: chatStatus?.firebaseHealth.status ?? 'unknown', tone: chatStatus?.firebaseHealth.status === 'healthy' ? 'emerald' : chatStatus?.firebaseHealth.status === 'unhealthy' ? 'rose' : 'amber' },
                          { label: 'Groq', value: chatStatus?.groqHealth?.status ?? 'unknown', tone: chatStatus?.groqHealth?.status === 'healthy' ? 'emerald' : chatStatus?.groqHealth?.status === 'unhealthy' ? 'rose' : 'amber' },
                          { label: 'API calls', value: String(chatStatus?.usage?.requestsLastMinute ?? 0), tone: 'slate' },
                        ].map((item) => (
                          <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-center">
                            <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                            <p className={`mt-1 text-lg font-semibold ${item.tone === 'emerald' ? 'text-emerald-700' : item.tone === 'rose' ? 'text-rose-600' : item.tone === 'amber' ? 'text-amber-600' : 'text-slate-800'}`}>{item.value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500">
                          <span>Request flow</span>
                          <span>{chartSeries[chartSeries.length - 1]?.label ?? 'Today'}</span>
                        </div>
                        <svg viewBox="0 0 260 100" className="h-20 w-full" aria-label="API and Firebase request chart">
                          <defs>
                            <linearGradient id="apiChartFill" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.08" />
                            </linearGradient>
                            <linearGradient id="firebaseChartFill" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.08" />
                            </linearGradient>
                          </defs>
                          <path d={`M 0 92 L ${apiChartPoints} L 260 92 Z`} fill="url(#apiChartFill)" opacity="0.6" />
                          <path d={`M 0 92 L ${firebaseChartPoints} L 260 92 Z`} fill="url(#firebaseChartFill)" opacity="0.55" />
                          <polyline points={apiChartPoints} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                          <polyline points={firebaseChartPoints} fill="none" stroke="#ec4899" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                          {[0, 1, 2, 3].map((tick) => (
                            <line key={tick} x1="0" x2="260" y1={20 + tick * 18} y2={20 + tick * 18} stroke="#e2e8f0" strokeDasharray="4 4" />
                          ))}
                        </svg>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" />API</span>
                          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-pink-500" />Firebase</span>
                        </div>
                      </div>
                    </article>

                    <article className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm">
                      <h3 className="text-lg font-semibold text-slate-900">Daily Metrics</h3>
                      <div className="mt-3 space-y-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                          <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">Errors</p>
                          <p className="mt-1 text-2xl font-semibold text-slate-900">{chatStatus?.usage?.errorsLastMinute ?? 0}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                          <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">Rate limits</p>
                          <p className="mt-1 text-2xl font-semibold text-slate-900">{chatStatus?.usage?.rateLimitHitsLastMinute ?? 0}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                          <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">Backoff</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">{chatStatus?.firebaseBackoffActive ? 'On' : 'Off'}</p>
                        </div>
                      </div>
                    </article>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <article className="rounded-[24px] border border-slate-200/70 bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-base font-semibold text-slate-900">Carousel Preview</h2>
                        <button type="button" onClick={() => setIsPreviewPlaying((current) => !current)} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50">
                          {isPreviewPlaying ? 'Pause' : 'Play'}
                        </button>
                      </div>

                      {form.imageSlides.length ? (
                        <>
                          {(() => {
                            const slide = form.imageSlides[previewImageIndex % form.imageSlides.length];
                            return (
                              <div className="relative mt-3 h-36 overflow-hidden rounded-xl border border-slate-200/70 sm:h-44">
                                <img src={slide.imageUrl} alt={slide.title} className="h-full w-full object-cover transition-all duration-700" style={{ objectPosition: slide.focus }} />
                                <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(0,0,0,0.05)_0%,_rgba(0,0,0,0.55)_100%)]" />
                                <div className="absolute bottom-2 left-3 right-3">
                                  <p className="text-sm font-semibold text-white">{slide.title}</p>
                                  <p className="mt-0.5 text-[11px] text-white/80">{slide.subtitle}</p>
                                </div>
                              </div>
                            );
                          })()}
                          <div className="mt-3 flex items-center justify-center gap-1.5">
                            {form.imageSlides.map((slide, index) => (
                              <button key={`carousel-dot-${slide.title}-${index}`} type="button" onClick={() => setPreviewImageIndex(index)} aria-label={`Show slide ${index + 1}`} className={`h-1.5 rounded-full transition-all ${index === previewImageIndex % form.imageSlides.length ? 'w-4 bg-slate-700' : 'w-1.5 bg-slate-300'}`} />
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">No carousel slides yet.</p>
                      )}
                    </article>

                    <article className="rounded-[24px] border border-slate-200/70 bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-base font-semibold text-slate-900">News Preview</h2>
                        <button type="button" onClick={() => setIsPreviewPlaying((current) => !current)} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50">
                          {isPreviewPlaying ? 'Pause' : 'Play'}
                        </button>
                      </div>

                      {form.newsSlides.length ? (
                        <>
                          {(() => {
                            const news = form.newsSlides[previewNewsIndex % form.newsSlides.length];
                            return (
                              <div className="mt-3 min-h-[9rem] rounded-xl border border-slate-200/70 bg-slate-50 p-3 transition-all duration-700 ease-out">
                                <p className="text-sm font-semibold text-slate-900">{news.title}</p>
                                <p className="mt-2 text-xs leading-5 text-slate-600">{news.body}</p>
                              </div>
                            );
                          })()}
                          <div className="mt-3 flex items-center justify-center gap-1.5">
                            {form.newsSlides.map((news, index) => (
                              <button key={`news-dot-${news.title}-${index}`} type="button" onClick={() => setPreviewNewsIndex(index)} aria-label={`Show news ${index + 1}`} className={`h-1.5 rounded-full transition-all ${index === previewNewsIndex % form.newsSlides.length ? 'w-4 bg-slate-700' : 'w-1.5 bg-slate-300'}`} />
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">No news cards yet.</p>
                      )}
                    </article>
                  </div>
                </div>
              ) : null}

              {activeSection === 'health' ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-[28px] border border-slate-200/70 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-xl font-semibold text-slate-900">Health Overview</h2>
                      <button type="button" onClick={() => void fetchChatStatus(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">Refresh</button>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {[
                        { label: 'Firebase', value: chatStatus?.firebaseHealth.status ?? 'unknown', detail: chatStatus?.firebaseBackoffActive ? 'Backoff active' : 'No backoff', tone: chatStatus?.firebaseHealth.status === 'healthy' ? 'emerald' : chatStatus?.firebaseHealth.status === 'unhealthy' ? 'rose' : 'amber' },
                        { label: 'Groq', value: chatStatus?.groqHealth?.status ?? 'unknown', detail: chatStatus?.groqHealth?.model ?? 'No model set', tone: chatStatus?.groqHealth?.status === 'healthy' ? 'emerald' : chatStatus?.groqHealth?.status === 'unhealthy' ? 'rose' : 'amber' },
                        { label: 'Requests / min', value: String(chatStatus?.usage?.requestsLastMinute ?? 0), detail: 'Latest minute traffic', tone: 'slate' },
                        { label: 'Errors / min', value: String(chatStatus?.usage?.errorsLastMinute ?? 0), detail: chatStatus?.usage?.lastErrorMessage ?? 'No recent errors', tone: chatStatus?.usage?.errorsLastMinute ? 'rose' : 'emerald' },
                      ].map((card) => (
                        <div key={card.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{card.label}</p>
                          <p className={`mt-2 text-2xl font-semibold ${card.tone === 'emerald' ? 'text-emerald-700' : card.tone === 'rose' ? 'text-rose-600' : card.tone === 'amber' ? 'text-amber-600' : 'text-slate-800'}`}>{card.value}</p>
                          <p className="mt-2 text-xs text-slate-500">{card.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200/70 bg-white p-4 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900">Daily Snapshot History</h3>
                    <div className="mt-4 space-y-3">
                      {dailyHealthSnapshots.length ? dailyHealthSnapshots.map((snapshot) => (
                        <div key={snapshot.id} className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-6 md:items-center">
                          <div><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Date</p><p className="mt-1 text-sm font-semibold text-slate-800">{snapshot.label}</p></div>
                          <div><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Firebase</p><p className="mt-1 text-sm text-slate-700">{snapshot.firebaseStatus}</p></div>
                          <div><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Groq</p><p className="mt-1 text-sm text-slate-700">{snapshot.groqStatus}</p></div>
                          <div><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Requests</p><p className="mt-1 text-sm text-slate-700">{snapshot.requests}</p></div>
                          <div><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Errors</p><p className="mt-1 text-sm text-slate-700">{snapshot.errors}</p></div>
                          <div><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Provider</p><p className="mt-1 text-sm text-slate-700">{snapshot.provider}</p></div>
                        </div>
                      )) : (
                        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">No daily health snapshots have been recorded yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeSection === 'carousel' ? (
                <CarouselEditorSection
                  form={form}
                  editingSlideIndex={editingSlideIndex}
                  uploadingSlideIndex={uploadingSlideIndex}
                  fieldClassName={fieldClassName}
                  setEditingSlideIndex={setEditingSlideIndex}
                  addSlide={addSlide}
                  removeSlide={removeSlide}
                  updateImageSlide={updateImageSlide}
                  uploadCarouselImage={uploadCarouselImage}
                  setContentStatus={setContentStatus}
                />
              ) : null}

              {activeSection === 'news' ? (
                <NewsEditorSection
                  form={form}
                  editingNewsIndex={editingNewsIndex}
                  fieldClassName={fieldClassName}
                  setEditingNewsIndex={setEditingNewsIndex}
                  addNews={addNews}
                  removeNews={removeNews}
                  updateNewsSlide={updateNewsSlide}
                />
              ) : null}

              {activeSection === 'data' ? (
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className={`${fieldClassName} max-w-xl`}
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search text fields (example: headline, helper text, label)"
                    />
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
                    <div className="mt-2 overflow-hidden rounded-xl border border-cyan-200/20">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="bg-[#0d2862]/70 text-xs uppercase tracking-wide text-cyan-100/80">
                            <th className="px-3 py-2 font-medium">Field</th>
                            <th className="px-3 py-2 font-medium">Value</th>
                            <th className="px-3 py-2 text-right font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTextFields.map(({ key, label, placeholder }) => (
                            <tr key={String(key)} className="border-t border-cyan-200/15 bg-[#0d2862]/60 align-top">
                              <td className="px-3 py-2 text-cyan-100/80">{label}</td>
                              <td className="px-3 py-2">
                                <input
                                  className={fieldClassName}
                                  value={String(form[key])}
                                  onChange={(event) => updateTextField(key, event.target.value)}
                                  placeholder={placeholder}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => updateTextField(key, '')}
                                    className="rounded-lg border border-rose-300/40 px-2 py-1 text-[11px] text-rose-100"
                                  >
                                    Clear
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  {!filteredTextFields.length ? (
                    <p className="rounded-xl border border-cyan-200/20 bg-[#122b63]/65 px-3 py-2 text-sm text-cyan-100/80">
                      No data found for your search.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {activeSection === 'collections' ? (
                <CollectionsEditorSection
                  dataCollectionLabels={dataCollectionLabels}
                  selectedDataKey={selectedDataKey}
                  setSelectedDataKey={setSelectedDataKey}
                  chatStatus={chatStatus}
                  isStatusLoading={isStatusLoading}
                  isSwitchingContentMode={isSwitchingContentMode}
                  isDataLoading={isDataLoading}
                  isDataSaving={isDataSaving}
                  isRefreshingKnowledge={isRefreshingKnowledge}
                  dataJson={dataJson}
                  setDataJson={setDataJson}
                  collectionHasInvalidJson={collectionHasInvalidJson}
                  dataStatus={dataStatus}
                  fieldClassName={fieldClassName}
                  loadCollectionJson={loadCollectionJson}
                  saveCollectionJson={saveCollectionJson}
                  resetCollectionJson={resetCollectionJson}
                  refreshKnowledgeNow={refreshKnowledgeNow}
                  fetchChatStatus={fetchChatStatus}
                  switchContentMode={switchContentMode}
                />
              ) : null}

              {activeSection === 'announcements' ? (
                <AnnouncementsSection />
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
