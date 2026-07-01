"use client";

import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Send, X } from 'lucide-react';
import { suggestedQuestions } from '@/data/suggestedQuestions';

const getMessageText = (message: { content?: string; parts?: Array<{ type: string; text?: string }> }) => {
  const stripMarkdownBold = (text: string) => text.replace(/\*\*/g, '');

  if (typeof message.content === 'string' && message.content) return stripMarkdownBold(message.content);
  if (Array.isArray(message.parts)) {
    return stripMarkdownBold(
      message.parts
      .filter((p) => p.type === 'text')
      .map((p) => p.text ?? '')
      .join('')
    );
  }
  return '';
};

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [isOpen, messages, isLoading]);

  useEffect(() => {
    const openChat = () => setIsOpen(true);

    window.addEventListener('open-chat-widget', openChat);
    return () => window.removeEventListener('open-chat-widget', openChat);
  }, []);

  const handleSuggestedQuestion = (question: string) => {
    if (isLoading) return;
    sendMessage({ parts: [{ type: 'text', text: question }] });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ parts: [{ type: 'text', text: input.trim() }] });
    setInput('');
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-stretch px-3 pb-3 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:items-end sm:px-0 sm:pb-0">
      {isOpen ? (
        <div className="mt-3 flex max-h-[min(86vh,820px)] w-full max-w-[calc(100vw-1.5rem)] self-end flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl sm:mt-4 sm:w-[420px] sm:max-w-[95vw] lg:w-[460px]">
          <div className="flex items-center justify-between bg-[#12aa9b] px-4 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xs font-bold text-[#12aa9b] shadow-sm">
                AP
              </div>
              <div>
                <p className="text-2sm font-semibold leading-none">Astoria Palawan Assistant</p>
                <p className="mt-1 text-xs text-teal-50">Talk with us</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 hover:text-white"
              aria-label="Close Assistant"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-3 py-4 text-sm sm:px-4">
            {messages.length === 0 ? (
              <>
                <div className="mx-auto max-w-full rounded-2xl border-2 border-slate-700 px-4 py-2 text-center text-sm text-slate-700">
                  Please select an option below:
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {suggestedQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => handleSuggestedQuestion(question)}
                      className="w-full max-w-full rounded-2xl border border-slate-500 bg-white px-3 py-2 text-left text-sm leading-5 text-slate-700 transition hover:border-slate-700 hover:bg-slate-50 sm:w-auto sm:max-w-[100%]"
                    >
                      {question}
                    </button>
                  ))}
                </div>
                <div className="max-w-[86%] rounded-3xl bg-slate-100 px-4 py-3 text-slate-800">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Bot</p>
                  <p className="mt-1">Welcome, Guest. How may I help you today?</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {suggestedQuestions.slice(0, 6).map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => handleSuggestedQuestion(question)}
                      className="w-full max-w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-left text-sm leading-5 text-slate-700 transition hover:border-slate-500 hover:bg-slate-50 sm:w-auto sm:max-w-[100%]"
                    >
                      {question}
                    </button>
                  ))}
                </div>
                {messages.map((message, index) => (
                  <div
                    key={`${message.id ?? index}-${message.role}`}
                    className={`max-w-[86%] rounded-3xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'ml-auto bg-[#2d74e7] text-white'
                        : 'bg-slate-100 text-slate-900'
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
                ))}
              </>
            )}

            {isLoading ? (
              <div className="max-w-[86%] rounded-3xl bg-slate-100 px-4 py-3 text-slate-700">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Bot</p>
                <p className="mt-1">Typing...</p>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-200/70 bg-white px-3 pb-3 pt-3 sm:px-4">
            <label className="sr-only" htmlFor="chat-input">
              Ask the concierge a question.
            </label>
            <div className="flex h-11 overflow-hidden rounded-full border border-slate-300 bg-white shadow-sm">
              <input
                id="chat-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit(e as unknown as React.FormEvent);
                  }
                }}
                placeholder="Send message..."
                className="h-full flex-1 border-0 bg-transparent px-4 text-sm text-slate-900 outline-none"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="inline-flex h-full items-center justify-center bg-[#12aa9b] px-5 text-sm font-semibold text-white transition hover:bg-[#109688] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'Sending...' : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
};

export default ChatWidget;
