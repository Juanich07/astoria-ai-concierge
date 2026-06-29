'use client';

import { useState } from 'react';
import { faqs } from '@/data/faqs';
import { motion } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

export default function FAQSection() {
  const [activeId, setActiveId] = useState<string | null>(faqs[0]?.id ?? null);

  return (
    <section id="faq" className="bg-background px-6 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12">
          <p className="text-sm uppercase tracking-[0.28em] text-amber-500">Frequently Asked Questions</p>
          <h2 className="mt-4 text-4xl font-display font-semibold text-dark sm:text-5xl">
            Everything you need to know before your stay.
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {faqs.map((faq, index) => {
            const isOpen = faq.id === activeId;
            return (
              <motion.div
                key={faq.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white shadow-soft"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  onClick={() => setActiveId(isOpen ? null : faq.id)}
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-semibold text-dark">{faq.question}</span>
                  {isOpen ? <Minus className="h-5 w-5 text-amber-500" /> : <Plus className="h-5 w-5 text-slate-400" />}
                </button>
                <div className={`px-6 pb-6 ${isOpen ? 'block' : 'hidden'}`}>
                  <p className="text-sm leading-7 text-slate-600">{faq.answer}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
