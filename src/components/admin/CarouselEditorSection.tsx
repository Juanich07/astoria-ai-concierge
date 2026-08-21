"use client";

import { Pencil, Trash2 } from 'lucide-react';
import type { LandingPageContent } from '@/data/landingContent';

type CarouselEditorSectionProps = {
  form: LandingPageContent;
  editingSlideIndex: number | null;
  uploadingSlideIndex: number | null;
  fieldClassName: string;
  setEditingSlideIndex: (index: number | null) => void;
  addSlide: () => void;
  removeSlide: (index: number) => void;
  updateImageSlide: (index: number, key: keyof LandingPageContent['imageSlides'][number], value: string) => void;
  uploadCarouselImage: (index: number, file: File) => Promise<void>;
  setContentStatus: (message: string) => void;
};

export default function CarouselEditorSection({
  form,
  editingSlideIndex,
  uploadingSlideIndex,
  fieldClassName,
  setEditingSlideIndex,
  addSlide,
  removeSlide,
  updateImageSlide,
  uploadCarouselImage,
  setContentStatus,
}: CarouselEditorSectionProps) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Edit Carousel</h2>
        <button
          type="button"
          onClick={() => {
            addSlide();
            setEditingSlideIndex(form.imageSlides.length);
          }}
          className="rounded-xl border border-cyan-200/35 bg-[#0d2862]/70 px-3 py-1.5 text-xs text-cyan-100"
        >
          Add slide
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-cyan-200/20">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-[#0d2862]/70 text-xs uppercase tracking-wide text-cyan-100/80">
              <th className="px-3 py-2 font-medium">Image</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Subtitle</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {form.imageSlides.map((slide, index) => (
              <tr key={`carousel-${index}`} className="border-t border-cyan-200/15 bg-[#122b63]/65 align-middle">
                <td className="px-3 py-2">
                  <img
                    src={slide.imageUrl || '/icons/astoria-bg.webp'}
                    alt={slide.title || 'Carousel slide preview'}
                    className="h-10 w-14 rounded-lg object-cover"
                    onError={(event) => {
                      event.currentTarget.src = '/icons/astoria-bg.webp';
                    }}
                  />
                </td>
                <td className="px-3 py-2 font-medium text-cyan-50">{slide.title || 'Untitled'}</td>
                <td className="px-3 py-2 text-cyan-100/75">{slide.subtitle || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingSlideIndex(index)}
                      aria-label="Edit slide"
                      className="rounded-lg border border-cyan-200/35 p-1.5 text-cyan-100 transition hover:bg-cyan-500/10"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {form.imageSlides.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeSlide(index)}
                        aria-label="Delete slide"
                        className="rounded-lg border border-rose-300/40 p-1.5 text-rose-100 transition hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingSlideIndex !== null && form.imageSlides[editingSlideIndex] ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-cyan-200/20 bg-[#122b63] p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-cyan-50">Edit slide</h3>
              <button
                type="button"
                onClick={() => setEditingSlideIndex(null)}
                aria-label="Close"
                className="rounded-lg border border-cyan-200/35 px-2 py-1 text-xs text-cyan-100"
              >
                Close
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <input
                className={fieldClassName}
                value={form.imageSlides[editingSlideIndex].title}
                onChange={(event) => updateImageSlide(editingSlideIndex, 'title', event.target.value)}
                placeholder="Slide title"
              />
              <input
                className={fieldClassName}
                value={form.imageSlides[editingSlideIndex].subtitle}
                onChange={(event) => updateImageSlide(editingSlideIndex, 'subtitle', event.target.value)}
                placeholder="Slide subtitle"
              />
              <input
                className={fieldClassName}
                value={form.imageSlides[editingSlideIndex].imageUrl}
                onChange={(event) => updateImageSlide(editingSlideIndex, 'imageUrl', event.target.value)}
                placeholder="Image URL"
              />
              <input
                className={fieldClassName}
                value={form.imageSlides[editingSlideIndex].focus}
                onChange={(event) => updateImageSlide(editingSlideIndex, 'focus', event.target.value)}
                placeholder="center / top / bottom"
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-cyan-200/35 bg-[#0d2862]/70 px-3 py-1 text-xs text-cyan-100">
                {uploadingSlideIndex === editingSlideIndex ? 'Uploading image...' : 'Upload image'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingSlideIndex === editingSlideIndex}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void uploadCarouselImage(editingSlideIndex, file);
                    }
                    event.currentTarget.value = '';
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  updateImageSlide(editingSlideIndex, 'imageUrl', '');
                  setContentStatus('Slide image removed. Save all changes to publish this update.');
                }}
                className="rounded-lg border border-rose-300/40 px-3 py-1 text-xs text-rose-100"
              >
                Remove image
              </button>
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border border-cyan-200/20 bg-slate-900/20">
              <div className="flex items-center justify-between border-b border-cyan-200/20 bg-[#0d2862]/70 px-2 py-1.5 text-[10px] uppercase tracking-[0.2em] text-cyan-100/80">
                <span>Preview</span>
                <span>{form.imageSlides[editingSlideIndex].imageUrl ? 'Active image' : 'No image yet'}</span>
              </div>
              <img
                src={form.imageSlides[editingSlideIndex].imageUrl || '/icons/astoria-bg.webp'}
                alt={form.imageSlides[editingSlideIndex].title || 'Carousel slide preview'}
                className="h-24 w-full object-cover"
                onError={(event) => {
                  event.currentTarget.src = '/icons/astoria-bg.webp';
                }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              {form.imageSlides.length > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    removeSlide(editingSlideIndex);
                    setEditingSlideIndex(null);
                  }}
                  className="rounded-lg border border-rose-300/40 px-3 py-1 text-xs text-rose-100"
                >
                  Remove slide
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setEditingSlideIndex(null)}
                className="rounded-lg border border-emerald-300/40 px-3 py-1 text-xs text-emerald-100"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
