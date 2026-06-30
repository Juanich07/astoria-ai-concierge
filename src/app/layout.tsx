import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Astoria Palawan Assistant – Astoria Hotels & Resorts',
  description: 'Luxury hotel concierge experience with a premium AI-first interface.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>{children}</body>
    </html>
  );
}
