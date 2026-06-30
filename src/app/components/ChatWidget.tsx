"use client";

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';

const getMessageText = (message: { content?: string; parts?: Array<{ type: string; text?: string }> }) => {
  if (typeof message.content === 'string' && message.content) return message.content;
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((p) => p.type === 'text')
      .map((p) => p.text ?? '')
      .join('');
  }
  return '';
};

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { messages, sendMessage, status, error } = useChat({
    api: '/api/chat',
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ parts: [{ type: 'text', text: input.trim() }] });
    setInput('');
  };

  const handleSaveInquiry = async () => {
    if (!messages.length) {
      return;
    }

    if (!isFirebaseConfigured || !db) {
      setSaveError('Firebase is not configured. Add your Firebase values to .env.local and restart the dev server.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await addDoc(collection(db, 'astoria_inquiries'), {
        createdAt: serverTimestamp(),
        conversation: messages.map((message) => ({
          role: message.role,
          content: getMessageText(message),
        })),
        source: 'chat-widget',
        status: 'pending',
      });
    } catch (error) {
      console.error('Failed to save inquiry to Firestore:', error);
      setSaveError('Unable to save inquiry. Check Firebase setup and Firestore rules.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-2xl shadow-amber-500/30 transition hover:bg-amber-400"
      >
        {isOpen ? 'Close Concierge' : 'Astoria Concierge'}
      </button>

      {isOpen ? (
        <div className="mt-4 w-[360px] max-w-full overflow-hidden rounded-[2rem] border border-amber-200/30 bg-slate-950/95 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
          <div className="border-b border-amber-500/20 bg-slate-900 px-5 py-4">
            <h2 className="text-lg font-semibold text-amber-200">Astoria Chatbot</h2>
            <p className="mt-1 text-xs text-slate-400">Ask about amenities, dining, spa, resort policies, or guest services.</p>
          </div>

          <div className="max-h-96 space-y-3 overflow-y-auto px-4 py-4 text-sm text-slate-100">
            {messages.length === 0 ? (
              <div className="rounded-3xl border border-amber-500/20 bg-slate-900/80 p-4 text-slate-300">
                Start a conversation to receive concierge guidance and resort information.
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.id ?? index}-${message.role}`}
                  className={`rounded-3xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'self-end bg-amber-500/10 text-amber-100'
                      : 'bg-slate-800/80 text-slate-100'
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
                    {message.role === 'user' ? 'You' : 'Astoria Concierge'}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{getMessageText(message)}</p>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 border-t border-amber-500/20 bg-slate-950 px-4 py-4">
            <label className="sr-only" htmlFor="chat-input">
              Ask the concierge a question.
            </label>
            <textarea
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }}
              placeholder="Ask about check-in, dining, spa, or guest services..."
              className="h-24 w-full rounded-3xl border border-slate-800 bg-slate-900/95 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="inline-flex min-w-[150px] items-center justify-center rounded-full bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'Sending…' : 'Send Message'}
              </button>

              <button
                type="button"
                onClick={handleSaveInquiry}
                disabled={isSaving || messages.length === 0}
                className="inline-flex min-w-[150px] items-center justify-center rounded-full border border-amber-400 bg-slate-900/90 px-4 py-3 text-sm font-semibold text-amber-200 transition hover:border-amber-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Saving…' : 'Submit Query to Staff'}
              </button>
            </div>

            {saveError ? (
              <p className="mt-3 rounded-3xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {saveError}
              </p>
            ) : null}
          </form>
        </div>
      ) : null}
    </div>
  );
};

export default ChatWidget;
