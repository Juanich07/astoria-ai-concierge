import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { groq } from '@ai-sdk/groq';
import { faqs } from '@/data/faqs';
import { resorts } from '@/data/resorts';
import { services } from '@/data/services';

const systemPrompt = `You are the official AI Guest Assistant for Astoria Hotels & Resorts. Your primary objective is to provide helpful, accurate, and welcoming information to guests about Astoria properties (such as Astoria Palawan, Astoria Current, Astoria Boracay, Astoria Plaza, and Astoria Bohol).

STRICT GROUNDING RULES:
1. ONLY answer questions using the knowledge base provided to you below.
2. If a guest asks a question that is NOT covered in the provided data, you must politely inform them that you do not have that information and offer to connect them to a human agent.
3. NEVER assume, extrapolate, or guess rules, pricing, check-in times, or amenities that are not explicitly written in your data.
4. Do not use outside knowledge or general internet data under any circumstances. If it is not in the provided data, it does not exist for you.

TONE AND STYLE:
- Always be polite, professional, warm, and hospitable, embodying Filipino hospitality.
- Keep your answers concise, clear, and easy to read using bullet points when listing amenities or rules.
- Address the user as "Guest" or by their name if provided.

FALLBACK RESPONSE RULE:
If the answer cannot be found in the data, reply exactly with:
"I'm sorry, I don't have the specific details regarding that in my current records. Let me connect you with our Front Desk or Reservations team to assist you further."

For reservation inquiries or live booking details, direct guests to: https://www.astoria.com.ph/`;

const knowledgePrompt = [
  'Astoria knowledge base:',
  'FAQs:',
  ...faqs.map((faq) => `- ${faq.question}\n  ${faq.answer}`),
  '\nResorts:',
  ...resorts.map((resort) => `- ${resort.name} (${resort.location})\n  ${resort.description}\n  Amenities: ${resort.amenities.join(', ')}`),
  '\nServices:',
  ...services.map((service) => `- ${service.title}\n  ${service.description}`),
].join('\n');

const fullSystemPrompt = `${systemPrompt}\n\n${knowledgePrompt}`;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const messages = Array.isArray(body.messages) ? body.messages : [];

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
