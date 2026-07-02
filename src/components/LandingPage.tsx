"use client";

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { defaultLandingContent, normalizeLandingPageContent } from '@/data/landingContent';
import { db, isFirebaseConfigured } from '@/lib/firebase';

export default function LandingPage() {
  const openChatWidget = () => {
    window.dispatchEvent(new CustomEvent('open-chat-widget'));
  };

  const [imageIndex, setImageIndex] = useState(0);
  const [newsIndex, setNewsIndex] = useState(0);
  const [content, setContent] = useState(defaultLandingContent);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    let isMounted = true;

    const loadLandingContent = async () => {
      try {
        const snapshot = await getDoc(doc(db, 'siteContent', 'landingPage'));
        if (!snapshot.exists() || !isMounted) return;
        setContent(normalizeLandingPageContent(snapshot.data()));
      } catch {
        setContent(defaultLandingContent);
      }
    };

    void loadLandingContent();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const imageCount = Math.max(content.imageSlides.length, 1);
    const newsCount = Math.max(content.newsSlides.length, 1);

    const interval = window.setInterval(() => {
      setImageIndex((current) => (current + 1) % imageCount);
      setNewsIndex((current) => (current + 1) % newsCount);
    }, 3200);

    return () => window.clearInterval(interval);
  }, [content.imageSlides.length, content.newsSlides.length]);

  const activeImageSlide = content.imageSlides[imageIndex] ?? defaultLandingContent.imageSlides[0];
  const activeNewsSlide = content.newsSlides[newsIndex] ?? defaultLandingContent.newsSlides[0];

  return (
    <main className="relative mx-auto min-h-screen max-w-[1440px] px-3 py-3 sm:px-6 sm:py-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <img
          src="/icons/astoria-bg.webp"
          alt="Astoria Palawan background"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[#031510]/24" />
        <div className="absolute left-[-10%] top-[-12%] h-[26rem] w-[26rem] rounded-full bg-[#12aa9b]/35 blur-3xl" />
        <div className="absolute bottom-[-14%] right-[-8%] h-[28rem] w-[28rem] rounded-full bg-[#12aa9b]/22 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(18,170,155,0.16),_transparent_35%),linear-gradient(135deg,_rgba(3,21,16,0.5)_0%,_rgba(10,42,31,0.4)_36%,_rgba(14,68,51,0.35)_68%,_rgba(27,197,165,0.2)_100%)]" />
      </div>

      <div className="relative z-10 flex flex-col gap-2 pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pb-8">
        <div className="text-[10px] font-medium uppercase tracking-[0.24em] text-emerald-100/80 sm:text-sm">
          {content.badgeTitle}
        </div>
        <div className="text-[10px] text-emerald-50/70 sm:text-sm sm:text-right">
          {content.helperText}
        </div>
      </div>

      <section className="relative z-10 mx-auto max-w-3xl space-y-3">
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-emerald-200/85">
            {content.eyebrow}
          </p>
          <h1 className="text-[2rem] font-semibold leading-[0.96] tracking-[-0.05em] text-white">
            {content.heading}
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="row-span-2 min-h-[150px] rounded-[24px] border border-white/15 bg-white/8 p-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur sm:min-h-[160px]">
            <p className="px-1 text-[10px] font-medium uppercase tracking-[0.24em] text-emerald-50/75">
              {content.carouselLabel}
            </p>
            <div className="relative mt-2.5 h-[182px] overflow-hidden rounded-[18px] border border-white/15 sm:h-[220px]">
              <img
                src={activeImageSlide.imageUrl}
                alt={activeImageSlide.title}
                className="h-full w-full object-cover transition-all duration-700"
                style={{ objectPosition: activeImageSlide.focus }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(0,0,0,0.05)_0%,_rgba(0,0,0,0.46)_100%)]" />
              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-[12px] font-semibold text-white sm:text-sm">{activeImageSlide.title}</p>
                <p className="mt-0.5 text-[10px] text-emerald-50/85 sm:text-[11px]">{activeImageSlide.subtitle}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/15 bg-white/10 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur">
            <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-emerald-50/75">
              {content.newsLabel}
            </p>
            <div className="mt-3 min-h-[96px] transition-all duration-700 ease-out">
              <p className="text-sm font-semibold text-white">{activeNewsSlide.title}</p>
              <p className="mt-2 text-xs leading-5 text-emerald-50/80">{activeNewsSlide.body}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={openChatWidget}
            className="col-span-1 min-h-[146px] rounded-[24px] bg-[linear-gradient(135deg,_#12aa9b_0%,_#25bea2_100%)] p-4 text-left text-white shadow-[0_18px_40px_rgba(0,0,0,0.26)] sm:min-h-[160px]"
          >
            <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-emerald-50/90">
              {content.chatbotLabel}
            </div>
            <div className="mt-10">
              <p className="text-2xl font-semibold tracking-[-0.05em]">{content.chatbotTitle}</p>
              <p className="mt-2 text-xs text-emerald-50/90">{content.chatbotSubtitle}</p>
            </div>
          </button>
        </div>
      </section>
    </main>
  );
}
