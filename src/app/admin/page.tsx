"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { defaultLandingContent, normalizeLandingPageContent, type LandingPageContent } from '@/data/landingContent';
import { faqs } from '@/data/faqs';
import { resorts } from '@/data/resorts';
import { services } from '@/data/services';
import { suggestedQuestions } from '@/data/suggestedQuestions';
import { testimonials } from '@/data/testimonials';
import { chatResponses } from '@/data/chatResponses';
import { tourPackages, sharedGroupTours, tourContact } from '@/data/tours';
import { intentKnowledgeSections, extendedKnowledge } from '@/data/extendedKnowledge';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';

type SectionId = 'overview' | 'carousel' | 'news' | 'data' | 'profile';
type TextFieldKey = Exclude<keyof LandingPageContent, 'imageSlides' | 'newsSlides'>;

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
  { id: 'profile', label: 'Admin Profile', hint: 'Picture, name, ID' },
];

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
            <h1 className="text-2xl font-semibold">Astoria Admin Login</h1>
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
            <aside className="rounded-3xl border border-cyan-200/25 bg-[#0f2255]/75 p-3 backdrop-blur">
              <div className="rounded-2xl border border-cyan-200/20 bg-[#132d68]/60 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Astoria Admin</p>
                <p className="mt-1 text-sm text-cyan-50/90">{user.email ?? 'Signed in admin'}</p>
              </div>

              <nav className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
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
