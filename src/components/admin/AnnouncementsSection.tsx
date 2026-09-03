"use client";

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import type { Announcement } from '@/types/admin';
import { CheckCircle2, Megaphone, Pencil, Plus, Save, Trash2, X } from 'lucide-react';

type FormState = { title: string; content: string };
const emptyForm: FormState = { title: '', content: '' };

export default function AnnouncementsSection() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // null = closed, 'new' = add form, id string = editing that item
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    void loadAnnouncements();
  }, []);

  async function loadAnnouncements() {
    setIsLoading(true);
    try {
      if (!isFirebaseConfigured || !db) {
        setStatusMsg('Firebase is not configured.');
        return;
      }
      const snap = await getDoc(doc(db!, 'siteContent', 'announcements'));
      const data = snap.data();
      if (Array.isArray(data?.items)) {
        setItems(data.items as Announcement[]);
      }
    } catch {
      setStatusMsg('Failed to load announcements from Firebase.');
    } finally {
      setIsLoading(false);
    }
  }

  async function persistItems(next: Announcement[]) {
    if (!isFirebaseConfigured || !db) return;
    await setDoc(doc(db!, 'siteContent', 'announcements'), { items: next }, { merge: false });
  }

  function openNew() {
    setForm(emptyForm);
    setEditingId('new');
  }

  function openEdit(item: Announcement) {
    setForm({ title: item.title, content: item.content });
    setEditingId(item.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveEntry() {
    if (!form.title.trim() || !form.content.trim()) return;
    setIsSaving(true);
    setStatusMsg('');
    try {
      let next: Announcement[];
      if (editingId === 'new') {
        const newItem: Announcement = {
          id: `ann_${Date.now()}`,
          title: form.title.trim(),
          content: form.content.trim(),
          createdAt: new Date().toISOString(),
        };
        next = [newItem, ...items];
      } else {
        next = items.map((item) =>
          item.id === editingId
            ? { ...item, title: form.title.trim(), content: form.content.trim() }
            : item
        );
      }
      await persistItems(next);
      setItems(next);
      setStatusMsg(editingId === 'new' ? 'Announcement added.' : 'Announcement updated.');
      cancelEdit();
    } catch {
      setStatusMsg('Save failed. Check Firebase connection.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this announcement? The chatbot will stop using it immediately.')) return;
    setIsSaving(true);
    try {
      const next = items.filter((item) => item.id !== id);
      await persistItems(next);
      setItems(next);
      setStatusMsg('Announcement deleted.');
    } catch {
      setStatusMsg('Delete failed.');
    } finally {
      setIsSaving(false);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-cyan-300/20 bg-[#0b2d23]/60 px-3 py-2 text-sm text-white outline-none placeholder:text-cyan-200/40 focus:border-cyan-300/60';

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border border-cyan-200/20 bg-[#122b63]/65 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-cyan-300" />
            <div>
              <h2 className="text-lg font-semibold">Announcements & Updates</h2>
              <p className="text-xs text-cyan-100/80">
                Add new buildings, events, notices, or any info the chatbot should know.
              </p>
            </div>
          </div>
          {editingId === null ? (
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-3 py-2 text-xs font-semibold text-[#04204e] hover:bg-cyan-300"
            >
              <Plus className="h-4 w-4" />
              Add New
            </button>
          ) : null}
        </div>

        {/* Add / Edit form */}
        {editingId !== null ? (
          <div className="mt-4 rounded-xl border border-cyan-200/30 bg-[#0d2862]/70 p-3 space-y-3">
            <p className="text-xs font-semibold text-cyan-100">
              {editingId === 'new' ? 'New Announcement' : 'Edit Announcement'}
            </p>
            <div className="space-y-2">
              <input
                className={inputClass}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Title — e.g. New Poolside Bar Now Open"
              />
              <textarea
                className={`${inputClass} min-h-[120px] resize-y`}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Describe the update in detail. The chatbot will use this to answer guest questions."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-xl border border-cyan-200/35 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-500/10"
              >
                <span className="flex items-center gap-1"><X className="h-3.5 w-3.5" /> Cancel</span>
              </button>
              <button
                type="button"
                onClick={() => void saveEntry()}
                disabled={isSaving || !form.title.trim() || !form.content.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-[#04204e] hover:bg-cyan-300 disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : null}

        {/* List */}
        <div className="mt-3 space-y-2">
          {isLoading ? (
            <p className="rounded-xl border border-cyan-200/20 bg-[#0d2862]/60 px-3 py-3 text-xs text-cyan-100/70">
              Loading announcements…
            </p>
          ) : items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-cyan-200/25 px-3 py-5 text-center text-xs text-cyan-100/50">
              No announcements yet. Click &ldquo;Add New&rdquo; to add information the chatbot should know.
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-cyan-200/20 bg-[#0d2862]/60 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-cyan-50">{item.title}</p>
                      <p className="mt-0.5 whitespace-pre-wrap text-xs text-cyan-100/75">{item.content}</p>
                      <p className="mt-1 text-[10px] text-cyan-100/40">
                        Added {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      aria-label="Edit"
                      className="rounded-lg border border-cyan-200/35 p-1.5 text-cyan-100 hover:bg-cyan-500/10"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteItem(item.id)}
                      aria-label="Delete"
                      className="rounded-lg border border-rose-300/35 p-1.5 text-rose-300 hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {statusMsg ? (
          <p className="mt-3 rounded-xl border border-cyan-200/30 bg-[#152f6c]/70 px-3 py-2 text-xs text-cyan-100/90">
            {statusMsg}
          </p>
        ) : null}
      </div>
    </div>
  );
}
