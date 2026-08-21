"use client";

import { useState } from 'react';
import { AlertTriangle, Bell, History, Save } from 'lucide-react';
import type { ActivityLogEntry, ChatStatus } from '@/types/admin';

type AdminHeaderBarProps = {
  now: Date;
  isSaving: boolean;
  hasHealthAlert: boolean;
  healthAlertCount: number;
  unreadActivityCount: number;
  chatStatus: ChatStatus | null;
  activityLogs: ActivityLogEntry[];
  onSaveContent: () => void;
  onMarkLogsSeen: () => void;
};

export default function AdminHeaderBar({
  now,
  isSaving,
  hasHealthAlert,
  healthAlertCount,
  unreadActivityCount,
  chatStatus,
  activityLogs,
  onSaveContent,
  onMarkLogsSeen,
}: AdminHeaderBarProps) {
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  return (
    <>
      <header className="mb-4 flex flex-col gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Admin Control Center</p>
          <h1 className="mt-0.5 text-lg font-semibold text-slate-900 sm:text-xl">Material Admin Dashboard</h1>
          <p className="text-xs text-slate-500">
            {now.toLocaleDateString()} • {now.toLocaleTimeString()}
          </p>
        </div>
        <div className="grid gap-2 sm:auto-cols-max sm:grid-flow-col sm:items-center">
          <button
            type="button"
            onClick={() => setIsHealthModalOpen(true)}
            aria-label="Service health notifications"
            className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
              hasHealthAlert
                ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            {hasHealthAlert ? <AlertTriangle className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            {healthAlertCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                {healthAlertCount > 1 ? healthAlertCount : ''}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsActivityModalOpen(true);
              onMarkLogsSeen();
            }}
            aria-label="Admin activity logs"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-700 transition hover:bg-slate-200"
          >
            <History className="h-4 w-4" />
            {unreadActivityCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                {unreadActivityCount > 1 ? unreadActivityCount : ''}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={onSaveContent}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-70"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </header>

      {isHealthModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Service Health</h3>
              <button
                type="button"
                onClick={() => setIsHealthModalOpen(false)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600"
              >
                Close
              </button>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="font-semibold text-slate-800">Firebase</p>
                <p className="mt-1 text-slate-600">Status: {chatStatus?.firebaseHealth.status ?? 'unknown'}</p>
                <p className="text-slate-600">Backoff: {chatStatus?.firebaseBackoffActive ? 'active' : 'inactive'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="font-semibold text-slate-800">Groq</p>
                <p className="mt-1 text-slate-600">Status: {chatStatus?.groqHealth?.status ?? 'unknown'}</p>
                <p className="text-slate-600">Model: {chatStatus?.groqHealth?.model ?? 'not set'}</p>
                <p className="text-slate-600">{chatStatus?.groqHealth?.message ?? 'No Groq issues detected.'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="font-semibold text-slate-800">API Usage (last minute)</p>
                <p className="mt-1 text-slate-600">Provider: {chatStatus?.usage?.provider ?? 'unknown'}</p>
                <p className="text-slate-600">Requests: {chatStatus?.usage?.requestsLastMinute ?? 0}</p>
                <p className="text-slate-600">Errors: {chatStatus?.usage?.errorsLastMinute ?? 0}</p>
                <p className="text-slate-600">Rate-limit hits: {chatStatus?.usage?.rateLimitHitsLastMinute ?? 0}</p>
                <p className="text-slate-600">Last error: {chatStatus?.usage?.lastErrorMessage ?? 'none'}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isActivityModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Admin Activity Logs</h3>
              <button
                type="button"
                onClick={() => setIsActivityModalOpen(false)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600"
              >
                Close
              </button>
            </div>
            <div className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto">
              {activityLogs.length ? (
                activityLogs.map((log) => (
                  <article key={log.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-800">{log.action}</p>
                    <p className="mt-1 text-xs text-slate-600">{log.details}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{log.userLabel} • {log.time}</p>
                  </article>
                ))
              ) : (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  No admin edits logged yet.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
