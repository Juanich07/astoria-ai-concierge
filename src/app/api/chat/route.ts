import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { groq } from '@ai-sdk/groq';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { doc, getDoc } from 'firebase/firestore/lite';
import { faqs } from '@/data/faqs';
import { resorts } from '@/data/resorts';
import { services } from '@/data/services';
import { tourPackages, tourContact } from '@/data/tours';
import { chatResponses } from '@/data/chatResponses';
import { intentKnowledgeSections } from '../../../data/extendedKnowledge';
import { defaultSettings, type HotelSettings } from '@/data/settings';
import { isFirebaseServerConfigured, serverDb } from '@/lib/firebaseServer';

export const runtime = 'nodejs';

const systemPrompt = `You are the Astoria Palawan Assistant.

RULES:
1. Answer ONLY from the knowledge base provided.
2. Be friendly and helpful, but concise.
3. For questions not in the data, say: "I don't have that information. Please dial 0 for Front Desk."
4. Use plain text only.
5. Never use markdown formatting or symbols such as **, *, #, _, or backticks.
6. Pick details from the most relevant intent section first (for example: dining, accommodations, amenities, waterpark, meetingsAndEvents, transport).
7. When a matching quick response exists, prefer it and keep wording consistent with the quick response.

RESPONSE FORMAT:
- Add a brief welcome or acknowledgment
- Present the information clearly
- Use line breaks for readability
- Keep it short but human-friendly
- No extra tips, no embellishments
- Output plain sentences and simple bullet lines only`;

type KnowledgeData = {
  faqs: Array<{ question: string; answer: string }>;
  tourPackages: Array<{ name: string; pricing: Array<{ pax: string; price: number }> }>;
  tourContact: { phone: string; email: string; note: string };
  resorts: Array<{ name: string; description: string }>;
  services: Array<{ title: string; description: string }>;
  chatResponses: Record<string, string>;
  intentSections: Record<string, string>;
  settings: HotelSettings;
};

type ContentMode = 'auto' | 'firebase' | 'local';

const KNOWLEDGE_CACHE_TTL_MS = 60_000;
const GROQ_CONNECTIVITY_TTL_MS = 30_000;
const FIREBASE_FETCH_TIMEOUT_MS = 2_000;
const FIREBASE_FAILURE_BACKOFF_MS = 60_000;
const CONTENT_MODE_CACHE_TTL_MS = 30_000;
const FIREBASE_CONTENT_ENABLED = process.env.ENABLE_FIREBASE_CONTENT !== 'false';

type ConnectivityCache = {
  reachable: boolean;
  checkedAt: number;
};

type CachedKnowledge = {
  knowledge: KnowledgeData;
  expiresAt: number;
  mode: ContentMode;
};

type ModeCache = {
  mode: ContentMode;
  expiresAt: number;
};

type FirebaseHealthState = {
  status: 'unknown' | 'healthy' | 'unhealthy' | 'skipped';
  lastCheckedAt: number | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
};

let cachedKnowledge: CachedKnowledge | null = null;
let inFlightKnowledgeLoad: Promise<CachedKnowledge> | null = null;
let cachedGroqConnectivity: ConnectivityCache | null = null;
let firebaseRetryAt = 0;
let manualContentMode: ContentMode = 'auto';
let cachedModeFromDb: ModeCache | null = null;
let firebaseHealth: FirebaseHealthState = {
  status: 'unknown',
  lastCheckedAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('firebase-timeout')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseIntentSections = (value: unknown): Record<string, string> | null => {
  if (!isObject(value)) return null;

  const entries = Object.entries(value)
    .filter((entry): entry is [string, unknown] => typeof entry[0] === 'string')
    .map(([key, content]) => [key, typeof content === 'string' ? content : ''] as const)
    .filter(([, content]) => content.length > 0);

  return entries.length ? Object.fromEntries(entries) : null;
};

const normalizeMode = (value: unknown): ContentMode => {
  if (value === 'firebase' || value === 'local' || value === 'auto') return value;
  return 'auto';
};

const updateFirebaseHealth = (status: FirebaseHealthState['status']) => {
  const now = Date.now();
  firebaseHealth = {
    ...firebaseHealth,
    status,
    lastCheckedAt: now,
    lastSuccessAt: status === 'healthy' ? now : firebaseHealth.lastSuccessAt,
    lastFailureAt: status === 'unhealthy' ? now : firebaseHealth.lastFailureAt,
  };
};

const getEffectiveMode = async (): Promise<ContentMode> => {
  if (manualContentMode !== 'auto') return manualContentMode;
  if (!FIREBASE_CONTENT_ENABLED || !serverDb || !isFirebaseServerConfigured) return 'local';

  const now = Date.now();
  if (cachedModeFromDb && cachedModeFromDb.expiresAt > now) {
    return cachedModeFromDb.mode;
  }

  try {
    const settingsSnap = await withTimeout(getDoc(doc(serverDb, 'siteContent', 'settings')), FIREBASE_FETCH_TIMEOUT_MS);
    const raw = settingsSnap.exists() && isObject(settingsSnap.data()) ? settingsSnap.data() : null;
    const fromDb = normalizeMode(raw?.contentMode);
    cachedModeFromDb = {
      mode: fromDb,
      expiresAt: Date.now() + CONTENT_MODE_CACHE_TTL_MS,
    };
    return fromDb;
  } catch {
    cachedModeFromDb = {
      mode: 'auto',
      expiresAt: Date.now() + CONTENT_MODE_CACHE_TTL_MS,
    };
    return 'auto';
  }
};

const toTokens = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);

const scoreByTokenOverlap = (query: string, target: string) => {
  const queryTokens = new Set(toTokens(query));
  if (!queryTokens.size) return 0;

  const targetTokens = new Set(toTokens(target));
  let score = 0;
  for (const token of queryTokens) {
    if (targetTokens.has(token)) score += 1;
  }
  return score;
};

const pickTopMatches = <T,>(items: T[], query: string, toText: (item: T) => string, limit: number): T[] => {
  if (!query.trim()) return items.slice(0, limit);

  const ranked = items
    .map((item) => ({ item, score: scoreByTokenOverlap(query, toText(item)) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);

  return ranked.length ? ranked : items.slice(0, limit);
};

const detectRelevantIntents = (query: string, intentSections: Record<string, string>) => {
  const lowered = query.toLowerCase();
  const intentKeywords: Record<string, string[]> = {
    dining: ['dining', 'food', 'restaurant', 'reserve', 'habitat', 'cafe', 'pickup', 'delivery', 'menu'],
    accommodations: ['room', 'suite', 'villa', 'accommodation', 'check-in', 'check in', 'check-out', 'bed'],
    waterpark: ['waterpark', 'slide', 'pool', 'rate', 'ticket', 'surf', 'river ride', 'bucket'],
    amenities: ['amenity', 'spa', 'gym', 'pod', 'pool', 'flash mart', 'store', 'fitness'],
    meetingsAndEvents: ['event', 'meeting', 'conference', 'wedding', 'proposal', 'mice', 'venue', 'capacity'],
    aboutAndLocation: ['about', 'location', 'address', 'sustainable', 'ethos', 'palawan'],
    transport: ['transfer', 'airport', 'seaport', 'bus', 'taxi', 'van', 'how to get there'],
  };

  const matched = Object.keys(intentSections).filter((intent) => {
    const keywords = intentKeywords[intent] ?? [];
    return keywords.some((keyword) => lowered.includes(keyword));
  });

  if (matched.length) return matched.slice(0, 2);
  return Object.keys(intentSections).slice(0, 1);
};

const readDocData = async (
  collectionName: string,
  docId: string,
  mode: ContentMode
): Promise<Record<string, unknown> | null> => {
  if (mode === 'local') {
    updateFirebaseHealth('skipped');
    return null;
  }

  if (!FIREBASE_CONTENT_ENABLED || !serverDb || !isFirebaseServerConfigured) {
    updateFirebaseHealth('skipped');
    return null;
  }

  if (Date.now() < firebaseRetryAt) {
    updateFirebaseHealth('unhealthy');
    return null;
  }

  try {
    const snapshot = await withTimeout(
      getDoc(doc(serverDb, collectionName, docId)),
      FIREBASE_FETCH_TIMEOUT_MS
    );
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    firebaseRetryAt = 0;
    updateFirebaseHealth('healthy');
    return isObject(data) ? data : null;
  } catch {
    firebaseRetryAt = Date.now() + FIREBASE_FAILURE_BACKOFF_MS;
    updateFirebaseHealth('unhealthy');
    return null;
  }
};

const isGroqReachable = async (): Promise<boolean> => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return false;

  const now = Date.now();
  if (cachedGroqConnectivity && now - cachedGroqConnectivity.checkedAt < GROQ_CONNECTIVITY_TTL_MS) {
    return cachedGroqConnectivity.reachable;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_500);

    const response = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const reachable = response.ok || response.status === 401 || response.status === 403;
    cachedGroqConnectivity = { reachable, checkedAt: now };
    return reachable;
  } catch {
    cachedGroqConnectivity = { reachable: false, checkedAt: now };
    return false;
  }
};

const resolveModel = async () => {
  if (await isGroqReachable()) {
    return groq('llama-3.1-8b-instant');
  }

  if (process.env.OPENAI_API_KEY) {
    return openai('gpt-4o-mini');
  }

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google('gemini-1.5-flash');
  }

  return null;
};

const buildKnowledgePrompt = (data: KnowledgeData, query: string) => {
  const selectedFaqs = pickTopMatches(data.faqs, query, (faq) => `${faq.question} ${faq.answer}`, 10);
  const selectedTours = pickTopMatches(data.tourPackages, query, (tour) => tour.name, 4);
  const selectedServices = pickTopMatches(data.services, query, (service) => `${service.title} ${service.description}`, 6);
  const selectedIntents = detectRelevantIntents(query, data.intentSections);
  const quickResponseLines = Object.entries(data.chatResponses).map(([key, value]) => `- ${key}: ${value}`);

  const settings = data.settings || {};

  return [
    'KNOWLEDGE BASE - Answer only from this:',
    '\nHOTEL SETTINGS (CRITICAL - Always use these values):',
    `- Check-in Time: ${settings.checkIn || '2:00 PM'}`,
    `- Check-out Time: ${settings.checkOut || '12:00 PM'}`,
    `- Front Desk Locations: ${Array.isArray(settings.frontDeskLocations) ? settings.frontDeskLocations.join(', ') : 'The Nest, The Canopy'}`,
    `- Emergency Number: ${settings.emergencyNumber || '0'}`,
    `- Restaurant Name: ${settings.restaurantName || 'The Reserve'}`,
    `- Restaurant Hours: ${settings.restaurantHours || '6:30 AM - 10:00 PM'}`,
    `- In-Room Dining Hours: ${settings.inRoomDiningHours || '6:00 AM - 11:30 PM'}`,
    `- Gym Hours: ${settings.gymHours || '6:00 AM - 10:00 PM'}`,
    `- Pool Hours: ${settings.poolHours || '6:00 AM - 10:00 PM'}`,
    `- Housekeeping Hours: ${settings.housekeepingHours || '9:00 AM - 5:00 PM'}`,
    `- Recreation Hours: ${settings.recreationHours || '8:00 AM - 11:00 PM'}`,
    `- WiFi Policy: ${settings.wifiPolicy || 'Free WiFi for 4 devices per room'}`,
    '\nQUICK RESPONSES (authoritative when applicable):',
    ...quickResponseLines,
    '\nFAQS (most relevant):',
    ...selectedFaqs.map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`),
    '\nTOURS (most relevant):',
    ...selectedTours.map((tour) =>
      `- ${tour.name}: ${tour.pricing.map((p) => `${p.pax} = Php ${p.price}`).join(' | ')}`
    ),
    '\nTOUR CONTACT:',
    `Phone: ${data.tourContact.phone}`,
    `Email: ${data.tourContact.email}`,
    `${data.tourContact.note}`,
    '\nRESORT:',
    ...data.resorts.map((resort) => `- ${resort.name}: ${resort.description}`),
    '\nSERVICES (most relevant):',
    ...selectedServices.map((service) => `- ${service.title}: ${service.description}`),
    '\nINTENT KNOWLEDGE SECTIONS (most relevant):',
    ...selectedIntents.flatMap((intent) => {
      const content = data.intentSections[intent] ?? '';
      return content ? [`\n[INTENT: ${intent}]`, content] : [];
    }),
  ].join('\n');
};

const loadKnowledgeData = async (mode: ContentMode): Promise<KnowledgeData> => {
  const fallback: KnowledgeData = {
    faqs,
    tourPackages,
    tourContact,
    resorts,
    services,
    chatResponses,
    intentSections: intentKnowledgeSections,
    settings: defaultSettings,
  };

  const [faqsDoc, toursDoc, resortsDoc, servicesDoc, knowledgeDoc, chatResponsesDoc, settingsDoc] = await Promise.all([
    readDocData('contentData', 'faqs', mode),
    readDocData('contentData', 'tours', mode),
    readDocData('contentData', 'resorts', mode),
    readDocData('contentData', 'services', mode),
    readDocData('siteContent', 'knowledge', mode),
    readDocData('siteContent', 'chatResponses', mode),
    readDocData('siteContent', 'settings', mode),
  ]);

  const firebaseFaqs = Array.isArray(faqsDoc?.items)
    ? faqsDoc.items.filter(
        (item): item is { question: string; answer: string } =>
          isObject(item) && typeof item.question === 'string' && typeof item.answer === 'string'
      )
    : [];

  const firebaseTourPackages = Array.isArray(toursDoc?.packages)
    ? toursDoc.packages.filter(
        (item): item is { name: string; pricing: Array<{ pax: string; price: number }> } =>
          isObject(item) &&
          typeof item.name === 'string' &&
          Array.isArray(item.pricing) &&
          item.pricing.every(
            (pricing) => isObject(pricing) && typeof pricing.pax === 'string' && typeof pricing.price === 'number'
          )
      )
    : [];

  const firebaseTourContact = isObject(toursDoc?.contact)
    ? {
        phone:
          typeof toursDoc.contact.phone === 'string' && toursDoc.contact.phone.length > 0
            ? toursDoc.contact.phone
            : fallback.tourContact.phone,
        email:
          typeof toursDoc.contact.email === 'string' && toursDoc.contact.email.length > 0
            ? toursDoc.contact.email
            : fallback.tourContact.email,
        note:
          typeof toursDoc.contact.note === 'string' && toursDoc.contact.note.length > 0
            ? toursDoc.contact.note
            : fallback.tourContact.note,
      }
    : fallback.tourContact;

  const firebaseResorts = Array.isArray(resortsDoc?.items)
    ? resortsDoc.items.filter(
        (item): item is { name: string; description: string } =>
          isObject(item) && typeof item.name === 'string' && typeof item.description === 'string'
      )
    : [];

  const firebaseServices = Array.isArray(servicesDoc?.items)
    ? servicesDoc.items.filter(
        (item): item is { title: string; description: string } =>
          isObject(item) && typeof item.title === 'string' && typeof item.description === 'string'
      )
    : [];

  const firebaseIntentSections = parseIntentSections(knowledgeDoc?.intentSections);

  const firebaseChatResponses = Object.keys(fallback.chatResponses).reduce<Record<string, string>>((acc, key) => {
    const value = chatResponsesDoc?.[key];
    acc[key] = typeof value === 'string' && value.length > 0 ? value : fallback.chatResponses[key];
    return acc;
  }, {});

  const firebaseSettings = isObject(settingsDoc)
    ? Object.entries(defaultSettings).reduce<HotelSettings>((acc, [key, value]) => {
        const k = key as keyof HotelSettings;
        const rawValue = settingsDoc[key];
        const isArray = Array.isArray(value);
        const isString = typeof value === 'string';
        const isNumber = typeof value === 'number';

        if (isArray && Array.isArray(rawValue)) {
          (acc as any)[k] = rawValue;
        } else if (isString && typeof rawValue === 'string' && rawValue.trim().length > 0) {
          (acc as any)[k] = rawValue;
        } else if (isNumber && typeof rawValue === 'number') {
          (acc as any)[k] = rawValue;
        } else {
          (acc as any)[k] = value;
        }
        return acc;
      }, { ...defaultSettings })
    : fallback.settings;

  return {
    faqs: firebaseFaqs.length ? firebaseFaqs : fallback.faqs,
    tourPackages: firebaseTourPackages.length ? firebaseTourPackages : fallback.tourPackages,
    tourContact: firebaseTourContact,
    resorts: firebaseResorts.length ? firebaseResorts : fallback.resorts,
    services: firebaseServices.length ? firebaseServices : fallback.services,
    chatResponses: firebaseChatResponses,
    intentSections: firebaseIntentSections ?? fallback.intentSections,
    settings: firebaseSettings,
  };
};

const getCachedKnowledge = async (): Promise<CachedKnowledge> => {
  const mode = await getEffectiveMode();
  const now = Date.now();
  if (cachedKnowledge && cachedKnowledge.mode === mode && cachedKnowledge.expiresAt > now) {
    return cachedKnowledge;
  }

  if (inFlightKnowledgeLoad) {
    return inFlightKnowledgeLoad;
  }

  inFlightKnowledgeLoad = (async () => {
    try {
      const knowledge = await loadKnowledgeData(mode);
      const nextCache: CachedKnowledge = {
        knowledge,
        mode,
        expiresAt: Date.now() + KNOWLEDGE_CACHE_TTL_MS,
      };

      cachedKnowledge = nextCache;
      return nextCache;
    } finally {
      inFlightKnowledgeLoad = null;
    }
  })();

  return inFlightKnowledgeLoad;
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  if (isObject(body) && body.action === 'status') {
    const mode = await getEffectiveMode();
    const now = Date.now();
    return Response.json({
      ok: true,
      contentMode: mode,
      manualContentMode,
      firebaseContentEnabled: FIREBASE_CONTENT_ENABLED,
      firebaseConfigured: !!serverDb && isFirebaseServerConfigured,
      firebaseHealth,
      firebaseBackoffActive: now < firebaseRetryAt,
      firebaseRetryAt: firebaseRetryAt || null,
      cacheExpiresAt: cachedKnowledge?.expiresAt ?? null,
      cacheMode: cachedKnowledge?.mode ?? null,
    });
  }

  if (isObject(body) && body.action === 'setContentMode') {
    const nextMode = normalizeMode(body.mode);
    manualContentMode = nextMode;
    cachedModeFromDb = {
      mode: nextMode,
      expiresAt: Date.now() + CONTENT_MODE_CACHE_TTL_MS,
    };
    cachedKnowledge = null;
    inFlightKnowledgeLoad = null;

    await getCachedKnowledge();
    return Response.json({ ok: true, contentMode: nextMode });
  }

  if (isObject(body) && body.action === 'refreshKnowledge') {
    cachedKnowledge = null;
    inFlightKnowledgeLoad = null;
    await getCachedKnowledge();

    return Response.json({ ok: true, refreshedAt: Date.now() });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const { knowledge } = await getCachedKnowledge();
  const model = await resolveModel();

  if (!model) {
    return Response.json(
      {
        error:
          'No reachable AI provider is configured. Add GROQ_API_KEY or a fallback (OPENAI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY).',
      },
      { status: 503 }
    );
  }

  const coreMessages = messages
    .map((msg: { role?: string; content?: string; parts?: Array<{ type: string; text?: string }> }) => {
      let content: string;
      if (typeof msg.content === 'string' && msg.content) {
        content = msg.content;
      } else if (Array.isArray(msg.parts)) {
        content = msg.parts
          .filter((p) => p.type === 'text')
          .map((p) => p.text ?? '')
          .join('');
      } else {
        content = '';
      }
      return { role: (msg.role ?? 'user') as 'user' | 'assistant', content };
    })
    .filter((m: { role: string; content: string }) => m.content);

  const latestUserMessage = [...coreMessages].reverse().find((message) => message.role === 'user')?.content ?? '';
  const knowledgePrompt = buildKnowledgePrompt(knowledge, latestUserMessage);

  const result = streamText({
    model,
    system: `${systemPrompt}\n\n${knowledgePrompt}`,
    messages: coreMessages,
  });

  return result.toUIMessageStreamResponse({
    onError: () =>
      "I'm having trouble connecting to our AI service right now. Please dial 0 for Front Desk.",
  });
}
