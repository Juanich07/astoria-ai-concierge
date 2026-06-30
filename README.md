# Astoria AI Concierge

## Setup steps

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the example environment file:
   ```bash
   cp .env.local.example .env.local
   ```
3. Open `.env.local` and add your secrets:
   - `OPENAI_API_KEY=sk-...`
   - Firebase values for `NEXT_PUBLIC_FIREBASE_*`
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open the app in the browser. If port 3000 is busy, Next.js may use 3001.

## What was added/changed

- `src/data/knowledge.ts`
  - builds resort-specific knowledge from `src/data/resorts.ts`, `src/data/faqs.ts`, and `src/data/services.ts`
- `src/app/api/chat/route.ts`
  - uses the OpenAI REST API to generate responses from `gpt-3.5-turbo`
  - requires `OPENAI_API_KEY`
- `src/components/ChatWidget.tsx`
  - real chat UI connected to `/api/chat`
  - replaced the old mock chat functionality
  - improved button styling and error handling
- `src/app/page.tsx`
  - now renders `ChatWidget` instead of the mock `FloatingChat`
- `src/components/Navbar.tsx`
  - fixed server-side rendering issue by using `useEffect` for `window` scroll handling
- `.env.local.example`
  - updated to include `OPENAI_API_KEY`

## Notes

- Do not commit `.env.local` to Git.
- If you move the project to another laptop, repeat:
  1. `npm install`
  2. create `.env.local`
  3. set `OPENAI_API_KEY`
  4. run `npm run dev`
- If you see a 500 error from the chat API, check that `OPENAI_API_KEY` is configured correctly.
