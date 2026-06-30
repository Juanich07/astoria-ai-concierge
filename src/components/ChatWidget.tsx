"use client";

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { MessageCircle, Send } from 'lucide-react';
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
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ parts: [{ type: 'text', text: input.trim() }] });
    setInput('');
  };

  const handleSaveInquiry = async () => {
    const trimmedInput = input.trim();
    const conversationSnapshot = [
      ...messages.map((message) => ({
        role: message.role,
        content: getMessageText(message),
      })),
      ...(trimmedInput ? [{ role: 'user', content: trimmedInput }] : []),
    ];

    if (!conversationSnapshot.length) {
      return;
    }

    if (!isFirebaseConfigured || !db) {
      setSaveError('Firebase is not configured. Add your Firebase values to .env.local and restart the dev server.');
      setSaveSuccess(null);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const docRef = await addDoc(collection(db, 'astoria_inquiries'), {
        createdAt: serverTimestamp(),
        conversation: conversationSnapshot,
        source: 'chat-widget',
        status: 'pending',
      });
      if (trimmedInput) {
        setInput('');
      }
      setSaveSuccess(`Saved to Firestore (astoria_inquiries) with ID: ${docRef.id}`);
    } catch (error) {
      console.error('Failed to save inquiry to Firestore:', error);
      setSaveError('Unable to save inquiry. Check Firebase setup and Firestore rules.');
      setSaveSuccess(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-full bg-[#1f6feb] px-5 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-[#1a5fcb]"
      >
        <MessageCircle className="h-4 w-4" />
        {isOpen ? 'Close Assistant' : 'Astoria Palawan Assistant'}
      </button>

      {isOpen ? (
        <div className="mt-4 w-[360px] max-w-[92vw] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="bg-[#1f6feb] px-4 py-4 text-white">
            <p className="text-sm font-semibold">Astoria Palawan Assistant</p>
            <p className="mt-1 text-xs text-blue-100">Talk with us</p>
          </div>

          <div className="max-h-[340px] space-y-3 overflow-y-auto bg-[#f8fafc] px-4 py-4 text-sm">
            {messages.length === 0 ? (
              <div className="max-w-[86%] rounded-2xl bg-[#e5e7eb] px-4 py-3 text-slate-800">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Bot</p>
                <p className="mt-1">Welcome, Guest. How may I help you today?</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.id ?? index}-${message.role}`}
                  className={`max-w-[86%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'ml-auto bg-[#2b7fff] text-white'
                      : 'bg-[#e5e7eb] text-slate-900'
                  }`}
                >
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-wide ${
                      message.role === 'user' ? 'text-blue-100' : 'text-slate-500'
                    }`}
                  >
                    {message.role === 'user' ? 'You' : 'Bot'}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap leading-6">{getMessageText(message)}</p>
                </div>
              ))
            )}

            {isLoading ? (
              <div className="max-w-[86%] rounded-2xl bg-[#e5e7eb] px-4 py-3 text-slate-700">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Bot</p>
                <p className="mt-1">Typing...</p>
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 border-t border-slate-200 bg-white px-4 py-4">
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
              placeholder="Compose your message..."
              className="min-h-[88px] w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#2b7fff] focus:ring-2 focus:ring-[#2b7fff]/20"
            />

            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2b7fff] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f6feb] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {isLoading ? 'Sending…' : 'Send Message'}
              </button>

              <button
                type="button"
                onClick={handleSaveInquiry}
                disabled={isSaving || (messages.length === 0 && !input.trim())}
                className="w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isSaving ? 'Saving…' : 'Submit Query to Staff'}
              </button>
            </div>

            {saveError ? (
              <p className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                {saveError}
              </p>
            ) : null}

            {saveSuccess ? (
              <p className="mt-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                {saveSuccess}
              </p>
            ) : null}
          </form>
        </div>
      ) : null}
    </div>
  );
};

export default ChatWidget;
