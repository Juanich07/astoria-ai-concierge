'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { MapPinned, RectangleHorizontal, RectangleVertical, X } from 'lucide-react';

const mapImage = '/icons/apw-map.jpg';

export default function ResortMap() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');

  useEffect(() => {
    if (!isOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative col-span-2 min-h-[146px] overflow-hidden rounded-[24px] border border-white/20 bg-[#147b69] p-4 text-left text-white shadow-[0_18px_40px_rgba(0,0,0,0.26)] transition hover:bg-[#176f63] sm:col-span-1 sm:min-h-[160px]"
        aria-label="Open resort map"
      >
        {!hasImageError ? (
          <Image
            src={mapImage}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-cover opacity-45 transition duration-300 hover:scale-105"
            onError={() => setHasImageError(true)}
          />
        ) : null}
        <span className="absolute inset-0 bg-gradient-to-r from-[#073b36]/90 via-[#073b36]/55 to-transparent" />
        <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
          <MapPinned className="h-6 w-6" />
        </span>
        <span className="relative mt-5 block text-2xl font-semibold">Resort map</span>
        <span className="relative mt-2 block text-xs text-emerald-50/85">Explore Astoria Palawan</span>
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Astoria Palawan resort map"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <div className="absolute right-3 top-3 z-10 flex gap-2">
            <button
              type="button"
              onClick={() => setOrientation((current) => current === 'landscape' ? 'portrait' : 'landscape')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/25 bg-black/55 px-3 text-white transition hover:bg-black/80"
              aria-label={`Switch to ${orientation === 'landscape' ? 'portrait' : 'landscape'} orientation`}
              title={`Switch to ${orientation === 'landscape' ? 'portrait' : 'landscape'}`}
            >
              {orientation === 'landscape' ? <RectangleVertical className="h-5 w-5" /> : <RectangleHorizontal className="h-5 w-5" />}
              <span className="text-xs font-medium capitalize">{orientation}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white transition hover:bg-black/80"
              aria-label="Close resort map"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {!hasImageError ? (
            <Image
              src={mapImage}
              alt="Astoria Palawan resort map showing villas, facilities, and attractions"
              width={1466}
              height={733}
              priority
              className={`object-contain transition-transform duration-300 ${orientation === 'landscape' ? 'max-h-[calc(100dvh-1rem)] w-auto max-w-full sm:max-h-[calc(100dvh-2rem)]' : 'h-auto max-h-none w-[min(90dvh,180dvw)] max-w-none rotate-90'}`}
              onError={() => setHasImageError(true)}
            />
          ) : (
            <div className="max-w-md px-6 text-center text-white">
              <MapPinned className="mx-auto h-10 w-10 text-emerald-300" />
              <p className="mt-4 text-lg font-semibold">Map image not found</p>
              <p className="mt-2 text-sm text-white/70">The resort map image could not be loaded.</p>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}