"use client";

import { useState } from 'react';
import { CheckCircle2, CircleX, Database, FileText, Pencil, RefreshCcw, Save, Sparkles } from 'lucide-react';
import type { ChatStatus, ContentMode, EditableDataKey } from '@/types/admin';

type CollectionsEditorSectionProps = {
  dataCollectionLabels: Record<EditableDataKey, string>;
  selectedDataKey: EditableDataKey;
  setSelectedDataKey: (key: EditableDataKey) => void;
  chatStatus: ChatStatus | null;
  isStatusLoading: boolean;
  isSwitchingContentMode: boolean;
  isDataLoading: boolean;
  isDataSaving: boolean;
  isRefreshingKnowledge: boolean;
  dataJson: string;
  setDataJson: (value: string) => void;
  collectionHasInvalidJson: boolean;
  dataStatus: string;
  fieldClassName: string;
  loadCollectionJson: (key: EditableDataKey) => Promise<void>;
  saveCollectionJson: () => Promise<void>;
  resetCollectionJson: () => void;
  refreshKnowledgeNow: () => Promise<void>;
  fetchChatStatus: (silent?: boolean) => Promise<void>;
  switchContentMode: (mode: ContentMode) => Promise<void>;
};

export default function CollectionsEditorSection({
  dataCollectionLabels,
  selectedDataKey,
  setSelectedDataKey,
  chatStatus,
  isStatusLoading,
  isSwitchingContentMode,
  isDataLoading,
  isDataSaving,
  isRefreshingKnowledge,
  dataJson,
  setDataJson,
  collectionHasInvalidJson,
  dataStatus,
  fieldClassName,
  loadCollectionJson,
  saveCollectionJson,
  resetCollectionJson,
  refreshKnowledgeNow,
  fetchChatStatus,
  switchContentMode,
}: CollectionsEditorSectionProps) {
  const [isCollectionEditorOpen, setIsCollectionEditorOpen] = useState(false);

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border border-cyan-200/20 bg-[#122b63]/65 p-3">
        <h2 className="text-lg font-semibold">Data Files Manager</h2>
        <p className="mt-1 text-xs text-cyan-100/80">
          Edit content data directly as JSON, then save to Firebase without redeploying code.
        </p>

        <div className="mt-3 rounded-xl border border-cyan-200/20 bg-[#0d2862]/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-cyan-100/80">Chatbot Content Source Mode</p>
            <button
              type="button"
              onClick={() => void fetchChatStatus()}
              disabled={isStatusLoading}
              className="rounded-lg border border-cyan-200/35 px-2 py-1 text-[11px] text-cyan-100 disabled:opacity-70"
            >
              {isStatusLoading ? 'Checking...' : 'Refresh status'}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {(['auto', 'firebase', 'local'] as ContentMode[]).map((mode) => {
              const active = (chatStatus?.manualContentMode ?? 'auto') === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => void switchContentMode(mode)}
                  disabled={isSwitchingContentMode}
                  className={`rounded-lg border px-2 py-1 text-[11px] uppercase tracking-[0.08em] transition disabled:opacity-70 ${
                    active
                      ? 'border-cyan-300/70 bg-cyan-300/20 text-white'
                      : 'border-cyan-200/30 bg-[#102b66]/60 text-cyan-100/80 hover:border-cyan-200/55'
                  }`}
                >
                  {mode}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-cyan-100/80">Effective mode: {chatStatus?.contentMode ?? 'unknown'}</span>
            <span className="text-cyan-100/60">|</span>
            <span className="text-cyan-100/80">Firebase health: {chatStatus?.firebaseHealth.status ?? 'unknown'}</span>
            {chatStatus?.firebaseBackoffActive ? (
              <span className="rounded-md border border-amber-300/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-100">
                Backoff active
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-cyan-200/20">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[#0f2a5a]/80 text-xs uppercase tracking-wide text-cyan-100/80">
                <th className="px-3 py-2 font-medium">Data File</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(dataCollectionLabels) as EditableDataKey[]).map((key) => (
                <tr key={key} className="border-t border-cyan-200/15 bg-[#102c66]/60">
                  <td className="px-3 py-2 text-cyan-50">{dataCollectionLabels[key]}</td>
                  <td className="px-3 py-2">
                    {selectedDataKey === key ? (
                      <span className="rounded-md border border-cyan-300/60 bg-cyan-300/20 px-2 py-0.5 text-[11px] text-cyan-100">
                        Selected
                      </span>
                    ) : (
                      <span className="text-[11px] text-cyan-100/65">Ready</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDataKey(key);
                          setIsCollectionEditorOpen(true);
                          void loadCollectionJson(key);
                        }}
                        aria-label={`Edit ${dataCollectionLabels[key]}`}
                        className="rounded-lg border border-cyan-200/35 p-1.5 text-cyan-100 transition hover:bg-cyan-500/10"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isCollectionEditorOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-6xl rounded-2xl border border-cyan-200/20 bg-[#122b63] p-3 shadow-2xl">
              <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-cyan-200/20 bg-[#132d68]/50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-cyan-100/85" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-cyan-100">Edit {dataCollectionLabels[selectedDataKey]}</p>
                    <p className="text-[10px] text-cyan-100/70">Make changes below and click Save to update Firebase</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCollectionEditorOpen(false);
                  }}
                  className="rounded-lg border border-cyan-200/35 px-2 py-1 text-xs text-cyan-100"
                >
                  Close
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void loadCollectionJson(selectedDataKey)}
                  disabled={isDataLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200/35 bg-[#0d2862]/70 px-3 py-2 text-xs text-cyan-100 transition hover:border-cyan-200/60 disabled:opacity-70"
                >
                  <RefreshCcw className="h-4 w-4" />
                  {isDataLoading ? 'Loading...' : 'Reload from Firebase'}
                </button>
                <button
                  type="button"
                  onClick={() => void saveCollectionJson()}
                  disabled={isDataSaving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-3 py-2 text-xs font-semibold text-[#04204e] transition hover:bg-cyan-300 disabled:opacity-70"
                >
                  <Save className="h-4 w-4" />
                  {isDataSaving ? 'Saving...' : 'Save to Firebase'}
                </button>
                <button
                  type="button"
                  onClick={resetCollectionJson}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200/35 bg-[#0d2862]/70 px-3 py-2 text-xs text-cyan-100 transition hover:border-cyan-200/60"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Reset to defaults
                </button>
                <button
                  type="button"
                  onClick={() => void refreshKnowledgeNow()}
                  disabled={isRefreshingKnowledge}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200/35 bg-[#0f3b3a]/80 px-3 py-2 text-xs text-emerald-100 transition hover:border-emerald-200/60 disabled:opacity-70"
                >
                  <Sparkles className="h-4 w-4" />
                  {isRefreshingKnowledge ? 'Refreshing bot...' : 'Refresh chatbot'}
                </button>
              </div>

              <div className="mt-3 max-h-[70vh] overflow-y-auto rounded-xl border border-cyan-200/20 bg-[#0d2862]/60 p-2">
                <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-cyan-200/30 bg-[#0f2a5a]/70 px-2.5 py-1.5">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-cyan-100/85" />
                    <div>
                      <p className="text-xs font-semibold text-cyan-50">{dataCollectionLabels[selectedDataKey]} JSON</p>
                      <p className="text-[10px] text-cyan-100/70">Edit the values directly</p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] ${
                      collectionHasInvalidJson ? 'bg-rose-500/30 text-rose-100' : 'bg-emerald-500/30 text-emerald-100'
                    }`}
                  >
                    {collectionHasInvalidJson ? <CircleX className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                    {collectionHasInvalidJson ? 'Invalid JSON' : 'Valid'}
                  </span>
                </div>
                <textarea
                  className={`${fieldClassName} min-h-[380px] font-mono text-xs`}
                  value={dataJson}
                  onChange={(event) => setDataJson(event.target.value)}
                  placeholder="JSON data will appear here..."
                  spellCheck={false}
                />

                {(selectedDataKey === 'faqs' || selectedDataKey === 'chatResponses') ? (
                  <p className="mt-2 rounded-lg border border-amber-300/35 bg-[#47361a]/65 px-2 py-1.5 text-[11px] text-amber-100/90">
                    Tip: update check-in/check-out and operational times in Hotel Settings for the chatbot to use the latest values.
                  </p>
                ) : null}
              </div>

              {dataStatus ? (
                <p className="mt-3 rounded-xl border border-cyan-200/30 bg-[#152f6c]/70 px-3 py-2 text-xs text-cyan-100/90">
                  {dataStatus}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
