"use client";

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const ChatPanel = dynamic(() => import('@/components/ChatPanel'), {
  ssr: false,
  loading: () => (
    <div className="mt-3 w-full max-w-[calc(100vw-1.5rem)] self-end rounded-[24px] border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-2xl sm:mt-4 sm:w-[420px] sm:max-w-[95vw] lg:w-[460px]">
      Loading assistant...
    </div>
  ),
});

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const openChat = () => setIsOpen(true);

    window.addEventListener('open-chat-widget', openChat);
    return () => window.removeEventListener('open-chat-widget', openChat);
  }, []);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-stretch px-3 pb-3 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:items-end sm:px-0 sm:pb-0">
      {isOpen ? <ChatPanel onClose={() => setIsOpen(false)} /> : null}
    </div>
  );
};

export default ChatWidget;
