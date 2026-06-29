'use client';

import { motion } from 'framer-motion';
import { resorts } from '@/data/resorts';
import { MapPin, Sparkles } from 'lucide-react';

export default function FeaturedResorts() {
  return (
    <section id="resorts" className="bg-background px-6 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-500">Featured Resorts</p>
          <h2 className="text-4xl font-display font-semibold text-dark sm:text-5xl">
            Four signature luxury stays designed for timeless comfort.
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
          {resorts.map((resort, index) => (
            <motion.article
              key={resort.id}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white shadow-soft transition hover:-translate-y-2 hover:shadow-glow"
            >
              <div className="h-72 bg-cover bg-center" style={{ backgroundImage: `url('${resort.image}')` }} />
              <div className="space-y-4 p-6">
                <div className="flex items-center gap-2 text-amber-500">
                  <Sparkles className="h-4 w-4" />
                  <p className="text-xs uppercase tracking-[0.28em] font-semibold">Luxury retreat</p>
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-dark">{resort.name}</h3>
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                    <MapPin className="h-4 w-4" />
                    {resort.location}
                  </p>
                </div>
                <p className="text-sm leading-7 text-slate-600">{resort.description}</p>
                <div className="space-y-3">
                  {resort.amenities.map((amenity) => (
                    <span key={amenity} className="inline-flex rounded-full border border-slate-200/70 px-3 py-2 text-xs font-medium text-slate-600">
                      {amenity}
                    </span>
                  ))}
                </div>
                <button className="inline-flex items-center justify-center rounded-full bg-dark px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900">
                  Discover more
                </button>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
