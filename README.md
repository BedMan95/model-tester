# AI Model Tester

A modern web app for testing LLM endpoints across OpenAI-compatible providers,
Anthropic, and Google Gemini: batch model availability testing, capability
checks, streaming chat, and side-by-side comparison.

Built with **Next.js 15 (App Router)**, **React 19**, **TypeScript**, and
**Tailwind CSS v4**.

## Features

- **Model Discovery** — live model catalogs for OpenAI-compatible, Anthropic,
  and Gemini endpoints.
- **Batch Parallel Testing** — test models in batches of 5 with a
  configurable timeout.
- **Status Badges** — `Work` (green), `Limit` (amber), `Fail` (red).
- **Capability Check** — Chat, Tools / Function calling, JSON mode,
  Streaming, and Vision, probed with provider-native request shapes.
- **Streaming Chat** — real time-to-first-token across all three providers,
  with persisted multi-session conversations.
- **Compare** — side-by-side responses with latency / throughput metrics.
- **History & Export** — last 100 test records, JSON and CSV export.
- **Presets** — one-click URLs for OpenRouter, Groq, Together, Ollama,
  LM Studio, vLLM, Anthropic, and Gemini; custom endpoints supported.
- **Dark / Light mode** with a persistent theme toggle.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

## Deployment (Vercel)

Import the repo into Vercel — the framework preset picks up `next`
automatically. No build command or environment variables are required;
credentials are entered in the browser and stored locally, so the same
deploy works for every provider.

## Project layout

- `src/app` — pages (`/`, `/chat`, `/compare`, `/history`) and API routes
  (`/api/models`, `/api/chat`, `/api/compat`).
- `src/lib/providers` — one module per provider family; routes dispatch on
  the request's `preset` or `url`.
- `src/components` — shared UI, app state, and the four tab views.

## License

MIT
