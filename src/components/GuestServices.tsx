'use client';

import { motion } from 'framer-motion';
import { services } from '@/data/services';
import { ArrowRight } from 'lucide-react';

export default function GuestServices() {
  return (
    <section id="services" className="border-t border-slate-200/70 bg-white px-6 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 max-w-2xl">
          <p className="text-sm uppercase tracking-[0.28em] text-amber-500">Guest Services</p>
          <h2 className="mt-4 text-4xl font-display font-semibold text-dark sm:text-5xl">
            Every detail is designed to enrich your stay with effortless luxury.
          </h2>
          <p className="mt-5 text-base leading-8 text-slate-600">
            From private transfers to bespoke dining, discover how our concierge experience brings premium service to life.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {services.map((service, index) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: index * 0.08 }}
              className="rounded-[2rem] border border-slate-200/70 bg-background p-7 shadow-soft"
            >
              <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-amber-50 text-amber-600 shadow-sm">
                <ArrowRight className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-dark">{service.title}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">{service.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
