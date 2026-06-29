'use client';

import { motion } from 'framer-motion';
import { Mail, MapPin, Phone } from 'lucide-react';

const contactItems = [
  {
    icon: MapPin,
    label: 'Location',
    value: 'Astoria Resorts Headquarters, Makati City, Philippines'
  },
  {
    icon: Mail,
    label: 'Email',
    value: 'concierge@astoriahotels.com'
  },
  {
    icon: Phone,
    label: 'Phone',
    value: '+63 2 1234 5678'
  }
];

export default function ContactSection() {
  return (
    <section id="contact" className="border-t border-slate-200/70 bg-white px-6 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-sm uppercase tracking-[0.28em] text-amber-500">Contact</p>
            <h2 className="mt-4 text-4xl font-display font-semibold text-dark sm:text-5xl">
              Let our concierge guide your next luxurious escape.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600">
              This is a polished mock interface built to support future AI concierge workflows and hotel service integration.
            </p>

            <div className="mt-10 space-y-4">
              {contactItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-start gap-4 rounded-[2rem] border border-slate-200/70 bg-background p-6 shadow-soft">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-amber-50 text-amber-600 shadow-sm">
                      <Icon className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-dark">{item.label}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-slate-950 p-8 text-white shadow-soft"
          >
            <div className="h-[360px] rounded-[1.75rem] bg-[linear-gradient(0deg,_rgba(255,255,255,0.16),_transparent),url('/images/contact-map.jpg')] bg-cover bg-center" />
            <div className="mt-8 rounded-[1.75rem] border border-white/10 bg-slate-900/90 p-6">
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-amber-300">Reserve your exclusive stay</p>
              <p className="mt-4 text-lg font-semibold">Reach out for private planning and concierge enquiries.</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
