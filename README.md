# Astoria Palawan Assistant

Astoria Palawan Assistant is a Next.js hospitality chatbot interface with a real AI chat flow powered by Groq and optional Firestore inquiry saving.

## Features

- Real-time chat UI connected to `src/app/api/chat/route.ts`
- Grounded answers from local data files:
  - `src/data/faqs.ts`
  - `src/data/resorts.ts`
  - `src/data/services.ts`
- Strict fallback behavior for unknown questions
- Optional "Submit Query to Staff" persistence to Firestore
- Responsive marketing site sections with chat widget overlay

## Tech Stack

- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/groq`)
- Firebase Firestore

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Copy environment template:

```bash
cp .env.local.example .env.local
```

For Windows PowerShell:

```powershell
Copy-Item .env.local.example .env.local
```

3. Fill in `.env.local` values:
- `GROQ_API_KEY`
- `NEXT_PUBLIC_FIREBASE_*`

4. Start development server:

```bash
npm run dev
```

5. Open `http://localhost:3000`

## Environment Variables

Required for AI chat:

- `GROQ_API_KEY`

Optional AI fallbacks when Groq is unreachable:

- `OPENAI_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

Required for Firestore save button:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (optional)

Optional for server-side content sync from Firestore in `POST /api/chat`:

- `ENABLE_FIREBASE_CONTENT=false` to force local-only content

If this flag is omitted, the API route will try Firestore reads when Firebase is configured and fall back to local data if the read fails.

## NPM Scripts

- `npm run dev` - start local development server
- `npm run build` - create production build
- `npm run start` - run production server
- `npm run lint` - run lint checks

## How Responses Are Generated

1. User sends a message from `src/components/ChatWidget.tsx`
2. Request goes to `POST /api/chat`
3. Route builds a grounded system prompt from:
   - FAQs
   - resorts
   - services
4. Groq model `llama-3.1-8b-instant` generates the response
5. Streamed response is returned to the UI

## Customize Assistant Knowledge

Edit these files to change what the assistant knows:

- `src/data/faqs.ts`
- `src/data/resorts.ts`
- `src/data/services.ts`

Update behavioral rules in:

- `src/app/api/chat/route.ts` (`systemPrompt`)

## Troubleshooting

### Internal Server Error in dev (`routes-manifest` or `middleware-manifest` missing)

On Windows this can happen if `.next` is corrupted or locked by a stale Node process.

Use:

```powershell
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

### Chat sends but no answer

Check:

- `GROQ_API_KEY` is valid
- `POST /api/chat` returns 200 in server logs
- You have not hit provider rate limits

### Save to staff fails

Check Firebase config and Firestore rules.

## Security Notes

- Never commit `.env.local`
- Rotate API keys if they are shared accidentally
- Keep provider keys server-side only
