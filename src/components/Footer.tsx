'use client';

import { Linkedin, Instagram, Twitter, Youtube } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-dark px-6 py-16 text-white lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.4fr_0.9fr_0.9fr]">
        <div className="space-y-6">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-300">Astoria AI Concierge</p>
          <p className="max-w-md text-sm leading-7 text-slate-300">
            A luxury interface built for hospitality storytelling, premium service moments, and future-ready AI integration.
          </p>
          <div className="flex items-center gap-4 text-slate-300">
            <a href="#" className="transition hover:text-white" aria-label="Instagram">
              <Instagram className="h-5 w-5" />
            </a>
            <a href="#" className="transition hover:text-white" aria-label="Twitter">
              <Twitter className="h-5 w-5" />
            </a>
            <a href="#" className="transition hover:text-white" aria-label="LinkedIn">
              <Linkedin className="h-5 w-5" />
            </a>
            <a href="#" className="transition hover:text-white" aria-label="Youtube">
              <Youtube className="h-5 w-5" />
            </a>
          </div>
        </div>

        <div>
          <h3 className="text-sm uppercase tracking-[0.3em] text-amber-300">Links</h3>
          <ul className="mt-5 space-y-3 text-sm text-slate-300">
            <li><a href="#about" className="transition hover:text-white">About</a></li>
            <li><a href="#resorts" className="transition hover:text-white">Resorts</a></li>
            <li><a href="#services" className="transition hover:text-white">Services</a></li>
            <li><a href="#faq" className="transition hover:text-white">FAQ</a></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm uppercase tracking-[0.3em] text-amber-300">Newsletter</h3>
          <p className="mt-5 text-sm text-slate-300">Receive exclusive updates and concierge previews.</p>
          <div className="mt-6 flex max-w-md flex-col gap-3 sm:flex-row">
            <input
              type="email"
              placeholder="Email address"
              className="w-full rounded-full border border-slate-600 bg-slate-900/90 px-5 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
            />
            <button className="inline-flex min-w-[140px] items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-dark transition hover:bg-amber-400">
              Subscribe
            </button>
          </div>
        </div>
      </div>

      <div className="mt-12 border-t border-slate-700/60 pt-8 text-sm text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Astoria Hotels & Resorts. All rights reserved.</span>
          <div className="flex gap-6">
            <a href="#" className="transition hover:text-white">Privacy</a>
            <a href="#" className="transition hover:text-white">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
