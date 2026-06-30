import { NextRequest, NextResponse } from 'next/server';
import { knowledgePrompt } from '@/data/knowledge';

export const runtime = 'edge';

const systemPrompt = `You are the Astoria Resorts guest concierge assistant. You represent Astoria Hotels and Resorts and provide information about the resort experience, amenities, dining, policies, and guest services.

You cannot access or look up live reservation details, bookings, or property management systems. If a guest asks to make a reservation, check availability, or inquire about existing bookings, politely explain that you cannot access live reservation data and redirect them to https://www.astoria.com.ph/ for reservations.

You know static resort details: check-in is at 2 PM, check-out is at 12 PM. You should provide helpful, polished concierge guidance, answer guest questions about the property, and make clear that you are an informational assistant, not a live booking system.`;

const fullSystemPrompt = `${systemPrompt}\n\n${knowledgePrompt}`;

export async function POST(request: NextRequest) {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    return new NextResponse('OpenAI API key is not configured.', { status: 500 });
  }

  const body = await request.json();
  const userMessages = Array.isArray(body.messages) ? body.messages : [];

  const payload = {
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: fullSystemPrompt,
      },
      ...userMessages,
    ],
    max_tokens: 1000,
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return new NextResponse(errorText, { status: response.status });
  }

  const data = await response.json();
  const assistantContent = data?.choices?.[0]?.message?.content ?? 'Sorry, no response was returned from the AI.';

  return new NextResponse(assistantContent, { status: 200 });
}
