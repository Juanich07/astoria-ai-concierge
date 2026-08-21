"use client";

import { CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import type { LandingPageContent } from '@/data/landingContent';

type NewsEditorSectionProps = {
  form: LandingPageContent;
  editingNewsIndex: number | null;
  fieldClassName: string;
  setEditingNewsIndex: (index: number | null) => void;
  addNews: () => void;
  removeNews: (index: number) => void;
  updateNewsSlide: (index: number, key: keyof LandingPageContent['newsSlides'][number], value: string) => void;
};

export default function NewsEditorSection({
  form,
  editingNewsIndex,
  fieldClassName,
  setEditingNewsIndex,
  addNews,
  removeNews,
  updateNewsSlide,
}: NewsEditorSectionProps) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Edit News</h2>
        <button
          type="button"
          onClick={() => {
            addNews();
            setEditingNewsIndex(form.newsSlides.length);
          }}
          className="rounded-xl border border-cyan-200/35 bg-[#0d2862]/70 px-3 py-1.5 text-xs text-cyan-100"
        >
          Add news card
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-cyan-200/20">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-[#0d2862]/70 text-xs uppercase tracking-wide text-cyan-100/80">
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Content</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {form.newsSlides.map((slide, index) => (
              <tr key={`news-${index}`} className="border-t border-cyan-200/15 bg-[#122b63]/65 align-top">
                {editingNewsIndex === index ? (
                  <>
                    <td className="px-3 py-2">
                      <input
                        className={fieldClassName}
                        value={slide.title}
                        onChange={(event) => updateNewsSlide(index, 'title', event.target.value)}
                        placeholder="News title"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <textarea
                        className={fieldClassName}
                        rows={3}
                        value={slide.body}
                        onChange={(event) => updateNewsSlide(index, 'body', event.target.value)}
                        placeholder="News content"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingNewsIndex(null)}
                          aria-label="Done editing"
                          className="rounded-lg border border-emerald-300/40 p-1.5 text-emerald-100 transition hover:bg-emerald-500/10"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        {form.newsSlides.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => {
                              removeNews(index);
                              setEditingNewsIndex(null);
                            }}
                            aria-label="Delete news card"
                            className="rounded-lg border border-rose-300/40 p-1.5 text-rose-100 transition hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 font-medium text-cyan-50">{slide.title || 'Untitled'}</td>
                    <td className="px-3 py-2 text-cyan-100/75">{slide.body || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingNewsIndex(index)}
                          aria-label="Edit news card"
                          className="rounded-lg border border-cyan-200/35 p-1.5 text-cyan-100 transition hover:bg-cyan-500/10"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {form.newsSlides.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeNews(index)}
                            aria-label="Delete news card"
                            className="rounded-lg border border-rose-300/40 p-1.5 text-rose-100 transition hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
