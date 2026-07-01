import ChatWidget from '@/components/ChatWidget';
import LandingPage from '@/components/LandingPage';

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#031510] text-white">
      <LandingPage />
      <ChatWidget />
    </div>
  );
}
