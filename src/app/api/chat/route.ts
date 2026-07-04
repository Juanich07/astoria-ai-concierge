import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { groq } from '@ai-sdk/groq';
import { doc, getDoc } from 'firebase/firestore/lite';
import { faqs } from '@/data/faqs';
import { resorts } from '@/data/resorts';
import { services } from '@/data/services';
import { tourPackages, tourContact } from '@/data/tours';
import { intentKnowledgeSections } from '../../../data/extendedKnowledge';
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
  intentSections: Record<string, string>;
};

const KNOWLEDGE_CACHE_TTL_MS = 60_000;

type CachedKnowledge = {
  knowledge: KnowledgeData;
  knowledgePrompt: string;
  expiresAt: number;
};

let cachedKnowledge: CachedKnowledge | null = null;
let inFlightKnowledgeLoad: Promise<CachedKnowledge> | null = null;

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

const readDocData = async (collectionName: string, docId: string): Promise<Record<string, unknown> | null> => {
  if (!serverDb || !isFirebaseServerConfigured) return null;

  try {
    const snapshot = await getDoc(doc(serverDb, collectionName, docId));
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    return isObject(data) ? data : null;
  } catch {
    return null;
  }
};

const buildKnowledgePrompt = (data: KnowledgeData) =>
  [
    'KNOWLEDGE BASE - Answer only from this:',
    '\nFAQS:',
    ...data.faqs.map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`),
    '\nTOURS:',
    ...data.tourPackages.map((tour) =>
      `- ${tour.name}: ${tour.pricing.map((p) => `${p.pax} = Php ${p.price}`).join(' | ')}`
    ),
    '\nTOUR CONTACT:',
    `Phone: ${data.tourContact.phone}`,
    `Email: ${data.tourContact.email}`,
    `${data.tourContact.note}`,
    '\nRESORT:',
    ...data.resorts.map((resort) => `- ${resort.name}: ${resort.description}`),
    '\nSERVICES:',
    ...data.services.map((service) => `- ${service.title}: ${service.description}`),
    '\nINTENT KNOWLEDGE SECTIONS:',
    ...Object.entries(data.intentSections).flatMap(([intent, content]) => [`\n[INTENT: ${intent}]`, content]),
  ].join('\n');

const loadKnowledgeData = async (): Promise<KnowledgeData> => {
  const fallback: KnowledgeData = {
    faqs,
    tourPackages,
    tourContact,
    resorts,
    services,
    intentSections: intentKnowledgeSections,
  };

  const [faqsDoc, toursDoc, resortsDoc, servicesDoc, knowledgeDoc] = await Promise.all([
    readDocData('contentData', 'faqs'),
    readDocData('contentData', 'tours'),
    readDocData('contentData', 'resorts'),
    readDocData('contentData', 'services'),
    readDocData('siteContent', 'knowledge'),
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

  return {
    faqs: firebaseFaqs.length ? firebaseFaqs : fallback.faqs,
    tourPackages: firebaseTourPackages.length ? firebaseTourPackages : fallback.tourPackages,
    tourContact: firebaseTourContact,
    resorts: firebaseResorts.length ? firebaseResorts : fallback.resorts,
    services: firebaseServices.length ? firebaseServices : fallback.services,
    intentSections: firebaseIntentSections ?? fallback.intentSections,
  };
};

const getCachedKnowledge = async (): Promise<CachedKnowledge> => {
  const now = Date.now();
  if (cachedKnowledge && cachedKnowledge.expiresAt > now) {
    return cachedKnowledge;
  }

  if (inFlightKnowledgeLoad) {
    return inFlightKnowledgeLoad;
  }

  inFlightKnowledgeLoad = (async () => {
    try {
      const knowledge = await loadKnowledgeData();
      const nextCache: CachedKnowledge = {
        knowledge,
        knowledgePrompt: buildKnowledgePrompt(knowledge),
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
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const { knowledgePrompt } = await getCachedKnowledge();

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

  const result = streamText({
    model: groq('llama-3.1-8b-instant'),
    system: `${systemPrompt}\n\n${knowledgePrompt}`,
    messages: coreMessages,
  });

  return result.toUIMessageStreamResponse();
}
