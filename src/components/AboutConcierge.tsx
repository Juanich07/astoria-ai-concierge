'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, Sparkles, Trophy } from 'lucide-react';

const features = [
  {
    title: 'Refined elegance',
    description: 'A premium interface created for calm, polished guest experiences.',
    icon: Sparkles
  },
  {
    title: 'Future-ready',
    description: 'Built to receive AI, hotel data, and concierge services without redesign.',
    icon: Trophy
  },
  {
    title: 'Immersive hospitality',
    description: 'Luxury storytelling, seamless navigation, and rich resort details.',
    icon: ShieldCheck
  }
];

export default function AboutConcierge() {
  return (
    <section id="about" className="border-t border-slate-200/70 bg-background px-6 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-sm uppercase tracking-[0.28em] text-amber-500">About AI Concierge</p>
            <h2 className="mt-4 text-4xl font-display font-semibold text-dark sm:text-5xl">
              A showcase of elevated service, crafted for future AI and resort integration.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600">
              The Astoria Palawan Assistant is designed as a luxury hotel interface with warm hospitality, minimal elegance, and premium visual refinement.
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.7 }}
                  className="rounded-[2rem] border border-slate-200/70 bg-white p-8 shadow-soft"
                >
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-amber-50 text-amber-600 shadow-sm">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-dark">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
