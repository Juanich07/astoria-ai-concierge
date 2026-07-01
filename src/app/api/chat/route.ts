import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { groq } from '@ai-sdk/groq';
import { faqs } from '@/data/faqs';
import { resorts } from '@/data/resorts';
import { services } from '@/data/services';
import { tourPackages, tourContact } from '@/data/tours';

const systemPrompt = `You are the Astoria Palawan Assistant.

RULES:
1. Answer ONLY from the knowledge base provided.
2. Be friendly and helpful, but concise.
3. For questions not in the data, say: "I don't have that information. Please dial 0 for Front Desk."
4. Use plain text only.
5. Never use markdown formatting or symbols such as **, *, #, _, or backticks.

RESPONSE FORMAT:
- Add a brief welcome or acknowledgment
- Present the information clearly
- Use line breaks for readability
- Keep it short but human-friendly
- No extra tips, no embellishments
- Output plain sentences and simple bullet lines only`;

const knowledgePrompt = [
  'KNOWLEDGE BASE - Answer only from this:',
  '\nFAQS:',
  ...faqs.map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`),
  '\nTOURS:',
  ...tourPackages.map((tour) => `- ${tour.name}: ${tour.pricing.map(p => `${p.pax} = Php ${p.price}`).join(' | ')}`),
  '\nTOUR CONTACT:',
  `Phone: ${tourContact.phone}`,
  `Email: ${tourContact.email}`,
  `${tourContact.note}`,
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
