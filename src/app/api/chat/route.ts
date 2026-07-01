import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { groq } from '@ai-sdk/groq';
import { faqs } from '@/data/faqs';
import { resorts } from '@/data/resorts';
import { services } from '@/data/services';
import { tourPackages } from '@/data/tours';

const systemPrompt = `You are the Astoria Palawan Assistant.

CRITICAL RULES:
1. Answer ONLY with information from the knowledge base below.
2. DO NOT add extra text, greetings, tips, or explanations.
3. Output ONLY the exact answer from the data. Nothing more.
4. If the question is not in the data, say: "I don't have that information. Dial 0 for Front Desk."

Format: Answer directly. No fluff. No embellishments.`;

const knowledgePrompt = [
  'KNOWLEDGE BASE - Answer only from this:',
  '\nFAQS:',
  ...faqs.map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`),
  '\nTOURS:',
  ...tourPackages.map((tour) => `- ${tour.name}: ${tour.pricing.map(p => `${p.pax} = Php ${p.price}`).join(' | ')}`),
  '\nRESORT:',
  ...resorts.map((resort) => `- ${resort.name}: ${resort.description}`),
  '\nSERVICES:',
  ...services.map((service) => `- ${service.title}: ${service.description}`),
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
