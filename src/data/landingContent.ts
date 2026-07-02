export type LandingImageSlide = {
  title: string;
  subtitle: string;
  focus: string;
  imageUrl: string;
};

export type LandingNewsSlide = {
  title: string;
  body: string;
};

export type LandingPageContent = {
  badgeTitle: string;
  helperText: string;
  eyebrow: string;
  heading: string;
  carouselLabel: string;
  newsLabel: string;
  chatbotLabel: string;
  chatbotTitle: string;
  chatbotSubtitle: string;
  imageSlides: LandingImageSlide[];
  newsSlides: LandingNewsSlide[];
};

export const defaultLandingContent: LandingPageContent = {
  badgeTitle: 'Astoria Palawan Assistant',
  helperText: 'Resort information, tours, dining, and guest support',
  eyebrow: 'Astoria Palawan',
  heading: 'How may I help you today?',
  carouselLabel: 'Image Carousel',
  newsLabel: 'News of the Day',
  chatbotLabel: 'Chatbot',
  chatbotTitle: 'Talk with Bot',
  chatbotSubtitle: 'Open the assistant',
  imageSlides: [
    {
      title: 'Main resort visual',
      subtitle: 'Carousel-ready image for testing',
      focus: 'center',
      imageUrl: '/icons/astoria-bg.webp',
    },
    {
      title: 'Poolside view',
      subtitle: 'Auto-moving slide preview',
      focus: 'top',
      imageUrl: '/icons/astoria-bg.webp',
    },
    {
      title: 'Resort grounds',
      subtitle: 'Testing carousel motion',
      focus: 'bottom',
      imageUrl: '/icons/astoria-bg.webp',
    },
  ],
  newsSlides: [
    {
      title: 'Welcome to Astoria Palawan',
      body: 'Ask about tours, dining, spa services, and guest support.',
    },
    {
      title: 'Tour bookings available',
      body: 'Ask about Underground River, Honda Bay, City Tour, Port Barton, and El Nido.',
    },
    {
      title: 'Guest support is ready',
      body: 'Dial 0 or tap the chatbot button anytime for assistance.',
    },
  ],
};

const asText = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
};

export const normalizeLandingPageContent = (value: unknown): LandingPageContent => {
  const source = (value ?? {}) as Record<string, unknown>;

  const imageSlidesRaw = Array.isArray(source.imageSlides) ? source.imageSlides : [];
  const imageSlides = imageSlidesRaw
    .map((item) => {
      const slide = (item ?? {}) as Record<string, unknown>;
      return {
        title: asText(slide.title, defaultLandingContent.imageSlides[0].title),
        subtitle: asText(slide.subtitle, defaultLandingContent.imageSlides[0].subtitle),
        focus: asText(slide.focus, 'center'),
        imageUrl: asText(slide.imageUrl, '/icons/astoria-bg.webp'),
      };
    })
    .slice(0, 10);

  const newsSlidesRaw = Array.isArray(source.newsSlides) ? source.newsSlides : [];
  const newsSlides = newsSlidesRaw
    .map((item) => {
      const slide = (item ?? {}) as Record<string, unknown>;
      return {
        title: asText(slide.title, defaultLandingContent.newsSlides[0].title),
        body: asText(slide.body, defaultLandingContent.newsSlides[0].body),
      };
    })
    .slice(0, 10);

  return {
    badgeTitle: asText(source.badgeTitle, defaultLandingContent.badgeTitle),
    helperText: asText(source.helperText, defaultLandingContent.helperText),
    eyebrow: asText(source.eyebrow, defaultLandingContent.eyebrow),
    heading: asText(source.heading, defaultLandingContent.heading),
    carouselLabel: asText(source.carouselLabel, defaultLandingContent.carouselLabel),
    newsLabel: asText(source.newsLabel, defaultLandingContent.newsLabel),
    chatbotLabel: asText(source.chatbotLabel, defaultLandingContent.chatbotLabel),
    chatbotTitle: asText(source.chatbotTitle, defaultLandingContent.chatbotTitle),
    chatbotSubtitle: asText(source.chatbotSubtitle, defaultLandingContent.chatbotSubtitle),
    imageSlides: imageSlides.length ? imageSlides : defaultLandingContent.imageSlides,
    newsSlides: newsSlides.length ? newsSlides : defaultLandingContent.newsSlides,
  };
};
