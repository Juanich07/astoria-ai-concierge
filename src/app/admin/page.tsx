"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { defaultLandingContent, normalizeLandingPageContent, type LandingPageContent } from '@/data/landingContent';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';

const fieldClassName = 'w-full rounded-xl border border-emerald-300/30 bg-[#07251d] px-3 py-2 text-sm text-white outline-none focus:border-emerald-300';

export default function AdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [form, setForm] = useState<LandingPageContent>(defaultLandingContent);

  useEffect(() => {
    if (!auth || !db || !isFirebaseConfigured) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setStatusMessage('');

      if (!nextUser) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      const [adminsSnap, adminSnap] = await Promise.all([
        getDoc(doc(db, 'admins', nextUser.uid)),
        getDoc(doc(db, 'admin', nextUser.uid)),
      ]);

      const activeDoc = adminsSnap.exists() ? adminsSnap : adminSnap;
      const allowed = activeDoc.exists() && activeDoc.data().active !== false;
      setIsAdmin(allowed);

      if (allowed) {
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

  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth) return;

    try {
      setStatusMessage('');
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign-in failed.';
      setStatusMessage(message);
    }
  };

  const saveContent = async () => {
    if (!db || !user || !isAdmin) return;

    try {
      setIsSaving(true);
      setStatusMessage('');

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
      setStatusMessage('Saved successfully. Landing page is now updated from Firebase.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed.';
      setStatusMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  const canRenderForm = useMemo(
    () => isFirebaseConfigured && !isLoading && !!user && isAdmin,
    [isLoading, isAdmin, user]
  );

  if (!isFirebaseConfigured) {
    return (
      <main className="min-h-screen bg-[#031510] px-4 py-8 text-white">
        <div className="mx-auto max-w-xl rounded-2xl border border-emerald-300/20 bg-[#052018] p-6">
          <h1 className="text-2xl font-semibold">Admin Panel</h1>
          <p className="mt-3 text-sm text-emerald-100/80">
            Firebase env values are missing. Add your NEXT_PUBLIC_FIREBASE variables first.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#031510] px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-2xl border border-emerald-300/20 bg-[#052018] p-6">
          <h1 className="text-2xl font-semibold">Astoria Admin</h1>
          <p className="mt-2 text-sm text-emerald-100/80">
            Edit landing page text, carousel images, and news content stored in Firebase.
          </p>
        </header>

        {!user ? (
          <section className="rounded-2xl border border-emerald-300/20 bg-[#052018] p-6">
            <h2 className="text-lg font-medium">Sign in</h2>
            <form onSubmit={login} className="mt-4 space-y-3">
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
                className="rounded-xl bg-[#12aa9b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#109688]"
              >
                Sign in
              </button>
            </form>
          </section>
        ) : null}

        {user && !isAdmin && !isLoading ? (
          <section className="rounded-2xl border border-red-300/30 bg-[#301414] p-6 text-red-100">
            <h2 className="text-lg font-medium">Access denied</h2>
            <p className="mt-2 text-sm">
              Add this user UID into Firestore: admins/{user.uid} with field active: true.
              Collection name admin is also accepted.
            </p>
            <button
              type="button"
              onClick={() => auth && signOut(auth)}
              className="mt-4 rounded-xl border border-red-200/40 px-4 py-2 text-sm"
            >
              Sign out
            </button>
          </section>
        ) : null}

        {canRenderForm ? (
          <section className="rounded-2xl border border-emerald-300/20 bg-[#052018] p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Landing page content</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveContent}
                  disabled={isSaving}
                  className="rounded-xl bg-[#12aa9b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#109688] disabled:opacity-60"
                >
                  {isSaving ? 'Saving...' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={() => auth && signOut(auth)}
                  className="rounded-xl border border-emerald-100/30 px-4 py-2 text-sm"
                >
                  Sign out
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-emerald-100/70">Top left badge title</label>
                <input
                  className={fieldClassName}
                  value={form.badgeTitle}
                  onChange={(event) => setForm((current) => ({ ...current, badgeTitle: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-emerald-100/70">Top right helper text</label>
                <input
                  className={fieldClassName}
                  value={form.helperText}
                  onChange={(event) => setForm((current) => ({ ...current, helperText: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-emerald-100/70">Eyebrow text</label>
                <input
                  className={fieldClassName}
                  value={form.eyebrow}
                  onChange={(event) => setForm((current) => ({ ...current, eyebrow: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-emerald-100/70">Main heading</label>
                <input
                  className={fieldClassName}
                  value={form.heading}
                  onChange={(event) => setForm((current) => ({ ...current, heading: event.target.value }))}
                />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-medium">Carousel slides</h3>
                <button
                  type="button"
                  onClick={() =>
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
                    }))
                  }
                  className="rounded-lg border border-emerald-100/30 px-3 py-1 text-xs"
                >
                  Add slide
                </button>
              </div>

              {form.imageSlides.map((slide, index) => (
                <div key={`image-${index}`} className="space-y-2 rounded-xl border border-emerald-100/20 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      className={fieldClassName}
                      value={slide.title}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          imageSlides: current.imageSlides.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, title: event.target.value } : item
                          ),
                        }))
                      }
                      placeholder="Slide title"
                    />
                    <input
                      className={fieldClassName}
                      value={slide.subtitle}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          imageSlides: current.imageSlides.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, subtitle: event.target.value } : item
                          ),
                        }))
                      }
                      placeholder="Slide subtitle"
                    />
                    <input
                      className={fieldClassName}
                      value={slide.imageUrl}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          imageSlides: current.imageSlides.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, imageUrl: event.target.value } : item
                          ),
                        }))
                      }
                      placeholder="Image URL"
                    />
                    <input
                      className={fieldClassName}
                      value={slide.focus}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          imageSlides: current.imageSlides.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, focus: event.target.value } : item
                          ),
                        }))
                      }
                      placeholder="Object position (center/top/bottom)"
                    />
                  </div>

                  {form.imageSlides.length > 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          imageSlides: current.imageSlides.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                      className="rounded-lg border border-red-300/40 px-3 py-1 text-xs text-red-100"
                    >
                      Remove slide
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-medium">News cards</h3>
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      newsSlides: [...current.newsSlides, { title: 'News title', body: 'News content' }],
                    }))
                  }
                  className="rounded-lg border border-emerald-100/30 px-3 py-1 text-xs"
                >
                  Add news
                </button>
              </div>

              {form.newsSlides.map((slide, index) => (
                <div key={`news-${index}`} className="space-y-2 rounded-xl border border-emerald-100/20 p-3">
                  <input
                    className={fieldClassName}
                    value={slide.title}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        newsSlides: current.newsSlides.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, title: event.target.value } : item
                        ),
                      }))
                    }
                    placeholder="News title"
                  />
                  <textarea
                    className={fieldClassName}
                    rows={3}
                    value={slide.body}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        newsSlides: current.newsSlides.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, body: event.target.value } : item
                        ),
                      }))
                    }
                    placeholder="News body"
                  />

                  {form.newsSlides.length > 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          newsSlides: current.newsSlides.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                      className="rounded-lg border border-red-300/40 px-3 py-1 text-xs text-red-100"
                    >
                      Remove news
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {statusMessage ? (
          <p className="rounded-xl border border-emerald-100/20 bg-[#052018] px-4 py-3 text-sm text-emerald-100/90">
            {statusMessage}
          </p>
        ) : null}
      </div>
    </main>
  );
}
