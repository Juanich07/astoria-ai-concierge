'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, X } from 'lucide-react';
import { chatResponses } from '@/data/chatResponses';
import { suggestedQuestions } from '@/data/suggestedQuestions';
import type { ChatMessage } from '@/types/chat';

const initialMessages: ChatMessage[] = [
  {
    id: 'm1',
    role: 'assistant',
    content: 'Welcome to Astoria Concierge. Ask me about check-in, dining, spa, or resort services.'
  }
];

const findMockResponse = (question: string) => {
  const normalized = question.toLowerCase();
  if (normalized.includes('check-in') || normalized.includes('check in')) return chatResponses.checkIn;
  if (normalized.includes('check-out') || normalized.includes('check out')) return chatResponses.checkOut;
  if (normalized.includes('amenities')) return chatResponses.amenities;
  if (normalized.includes('spa')) return chatResponses.spa;
  if (normalized.includes('restaurant') || normalized.includes('dining')) return chatResponses.restaurant;
  if (normalized.includes('pool')) return chatResponses.pool;
  if (normalized.includes('airport') || normalized.includes('transfer')) return chatResponses.transfers;
  if (normalized.includes('family')) return chatResponses.family;
  if (normalized.includes('location')) return chatResponses.location;
  if (normalized.includes('parking')) return chatResponses.parking;
  if (normalized.includes('wifi')) return chatResponses.wifi;
  if (normalized.includes('business') || normalized.includes('gym') || normalized.includes('kids') || normalized.includes('pet')) {
    if (normalized.includes('business')) return chatResponses.business;
    if (normalized.includes('gym')) return chatResponses.gym;
    if (normalized.includes('kids')) return chatResponses.kids;
    if (normalized.includes('pet')) return chatResponses.petPolicy;
  }
  if (normalized.includes('contact')) return chatResponses.contact;
  return chatResponses.general;
};

export default function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const element = document.getElementById('chat-scroll');
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, isOpen]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: input.trim()
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const response = findMockResponse(userMessage.content);
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: response
        }
      ]);
      setIsTyping(false);
    }, 1200);
  };

  const onSuggestionClick = (text: string) => {
    setInput(text);
    setTimeout(handleSend, 120);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-full">
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.96 }}
            className="rounded-[2rem] border border-white/80 bg-white/95 shadow-glow backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-4 rounded-[2rem] border-b border-slate-200/70 bg-slate-950 px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-amber-500 text-dark">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold">Astoria Concierge</p>
                  <p className="text-xs text-slate-300">Online</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Close chat" className="rounded-full bg-white/10 p-2 text-slate-200 transition hover:bg-white/20">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div id="chat-scroll" className="max-h-[420px] space-y-4 overflow-y-auto p-5 text-sm text-slate-700">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[84%] rounded-3xl px-4 py-3 shadow-sm ${message.role === 'assistant' ? 'bg-slate-100 text-slate-800' : 'bg-amber-500 text-slate-950'}`}>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{message.role === 'assistant' ? 'Astoria Concierge' : 'You'}</p>
                    <p className="mt-2 leading-7">{message.content}</p>
                  </div>
                </div>
              ))}
              {isTyping ? (
                <div className="flex justify-start">
                  <div className="rounded-3xl bg-slate-100 px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-500">
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-slate-500" />
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-slate-500 delay-150" />
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-slate-500 delay-300" />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-3 border-t border-slate-200/70 px-5 py-4 bg-white/90">
              <div className="grid gap-2">
                {suggestedQuestions.slice(0, 4).map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => onSuggestionClick(question)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-left text-sm text-slate-600 transition hover:border-amber-300 hover:bg-amber-50"
                  >
                    {question}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask a question..."
                  className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-dark text-white transition hover:bg-slate-800"
                  aria-label="Send message"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!isOpen ? (
        <motion.button
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-3 rounded-full bg-dark px-4 py-3 text-sm font-semibold text-white shadow-glow focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          aria-label="Open live chat"
        >
          <MessageCircle className="h-5 w-5" />
          Concierge
        </motion.button>
      ) : null}
    </div>
  );
}
