'use client';

import { motion } from 'framer-motion';
import { ArrowDown, Sparkles } from 'lucide-react';

export default function Hero() {
  return (
    <section id="home" className="relative overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(201,162,39,0.16),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(14,123,88,0.18),_transparent_28%)]" />
      <div className="relative mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
        <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <motion.div initial={{ opacity: 0, x: -48 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.9 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/60 bg-white/80 px-4 py-2 text-sm font-medium text-dark shadow-sm">
              <Sparkles className="h-4 w-4 text-luxury" />
              Luxury hospitality, reimagined.
            </span>
            <h1 className="mt-8 max-w-3xl text-5xl font-display font-semibold tracking-tight text-dark sm:text-6xl">
              Astoria Palawan Assistant — a refined guest experience for modern luxury travel.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Discover a premium concierge interface inspired by iconic resort hospitality. Everything is crafted for a warm, spacious, and elegant guest journey.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <a
                href="#about"
                className="inline-flex items-center justify-center rounded-full bg-dark px-6 py-3 text-base font-semibold text-white transition hover:bg-slate-900"
              >
                Explore the experience
              </a>
              <a
                href="#resorts"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-base font-semibold text-dark transition hover:border-slate-300"
              >
                Featured resorts
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 48 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9 }}
            className="relative overflow-hidden rounded-[2rem] border border-slate-200/60 bg-white shadow-soft"
          >
            <div className="h-[520px] bg-[linear-gradient(180deg,_rgba(29,29,29,0.3),_transparent_75%),url('/images/hero-resort.jpg')] bg-cover bg-center" />
          </motion.div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl justify-center px-6 pb-12 lg:px-8">
        <motion.div
          animate={{ y: [0, 12, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          className="inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/90 px-5 py-3 text-sm text-slate-600 shadow-soft"
        >
          Scroll to discover the signature resort experience
          <ArrowDown className="h-4 w-4" />
        </motion.div>
      </div>
    </section>
  );
}
