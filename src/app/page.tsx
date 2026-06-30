import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import AboutConcierge from '@/components/AboutConcierge';
import FeaturedResorts from '@/components/FeaturedResorts';
import GuestServices from '@/components/GuestServices';
import FAQSection from '@/components/FAQSection';
import ContactSection from '@/components/ContactSection';
import Footer from '@/components/Footer';
import ChatWidget from '@/components/ChatWidget';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-slate-900">
      <Navbar />
      <main>
        <Hero />
        <AboutConcierge />
        <FeaturedResorts />
        <GuestServices />
        <FAQSection />
        <ContactSection />
      </main>
      <Footer />
      <ChatWidget />
    </div>
  );
}
