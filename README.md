<div align="center">

# AI Model Tester

**Test, compare, and chat with LLM endpoints across OpenAI-compatible providers, Anthropic, and Google Gemini — from one browser UI.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Security & Privacy](#security--privacy)
- [Project Structure](#project-structure)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Overview

AI Model Tester is a single-page studio for probing LLM endpoints. Instead of
writing curl scripts per provider, you register an endpoint and API key once in
the browser and get live model catalogs, batch availability testing, capability
probing, streaming chat with latency metrics, and side-by-side comparison.

All credentials are entered in the browser and stored locally — nothing is sent
to or persisted on any server beyond the provider request itself.

## Features

- **Model Discovery** — live model catalogs for OpenAI-compatible, Anthropic,
  and Gemini endpoints.
- **Batch Parallel Testing** — test models in batches of 5 with a configurable
  timeout.
- **Status Badges** — `Work` (green), `Limit` (amber), `Fail` (red).
- **Capability Check** — Chat, Tools / Function calling, JSON mode, Streaming,
  and Vision, probed with provider-native request shapes.
- **Streaming Chat** — real time-to-first-token across all three providers,
  with persisted multi-session conversations.
- **Compare** — side-by-side responses with latency / throughput metrics.
- **History & Export** — last 100 test records, JSON and CSV export.
- **Presets** — one-click URLs for OpenRouter, Groq, Together, Ollama,
  LM Studio, vLLM, Anthropic, and Gemini; custom endpoints supported.
- **Dark / Light mode** with a persistent theme toggle.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| Language | TypeScript |
| Icons | Phosphor Icons |
| Animation | Motion |
| Provider SDK | OpenAI SDK (lazy-loaded, OpenAI-compatible family), native REST for Anthropic / Gemini |

## Quick Start

**Requirements:** Node.js 18+ and npm.

```bash
# 1. Clone the repository
git clone https://github.com/BedMan95/model-tester.git
cd model-tester

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev        # http://localhost:3000
```

No environment variables or API keys are required to run — credentials are
entered in the browser at runtime and stored locally.

## Usage

1. **Add an endpoint** — pick a preset (OpenRouter, Groq, Together, Ollama,
   LM Studio, vLLM, Anthropic, Gemini) or paste a custom base URL, then supply
   the API key.
2. **Discover models** — pull the live catalog from the endpoint.
3. **Batch test** — run availability checks across models in parallel batches
   and inspect Work / Limit / Fail results.
4. **Capability check** — probe Chat, Tools, JSON mode, Streaming, and Vision
   per model.
5. **Chat / Compare** — stream a conversation with time-to-first-token, or run
   the same prompt against multiple models side by side.
6. **History** — review the last 100 test records and export as JSON or CSV.

## Security & Privacy

AI Model Tester handles **your** provider API keys, so treat it accordingly:

- **Where keys live.** Credentials are stored in your browser's `localStorage`
  (key: per-app, under `model_tester_*` entries) and are never written to a
  database, remote service, or telemetry pipeline.
- **Browser-direct requests.** By default the browser calls your provider
  endpoint **directly** — the API key goes to the provider and nowhere else. It
  never transits the deployment hosting this app. (Anthropic's API is contacted
  with the `anthropic-dangerous-direct-browser-access` header so browser CORS
  works; OpenAI's SDK runs client-side.)
- **Proxy fallback.** Some endpoints do not allow browser requests via CORS
  (e.g. `api.openai.com`, vLLM deployments without CORS enabled). When a
  direct call is blocked, the app makes no SDK retries, falls back **once**
  through its own API routes (`/api/models`, `/api/chat`, `/api/compat`), and
  shows a "via proxy" badge — for that request the key does transit the
  deployment, used transiently and never persisted server-side.
  The blocked endpoint is then **remembered**, so later requests go straight
  through the proxy without paying a failed direct attempt each time; use
  "Forget CORS-blocked endpoints" (Tester → Advanced parameters) to retry
  direct. You can force the proxy for every request with the **Server proxy**
  toggle in the same place. Enabling CORS for your site's origin on your own
  router is the cleanest way to keep everything browser-direct.
- **Local endpoints.** An HTTPS-hosted deployment cannot call `http://localhost`
  providers (Ollama, LM Studio, vLLM) directly — browsers block mixed content.
  Run the app from `http://localhost:3000` to test local endpoints.
- **No server-side storage.** Deployments have no accounts, no secrets, and no
  environment variables to leak. Everything a deployment needs is the code.
- **Shared or public devices.** `localStorage` is **unencrypted** — anyone with
  access to the browser profile can read stored keys. Use a private window or
  your own machine, and clear the app's site data when done.
- **Scope keys where possible.** Prefer provider keys that are read-only or
  limited to the models/endpoints you are testing, with a spend cap. Rotate
  any key after using the app on a device you don't control.
- **Public deployments.** Direct mode keeps visitor keys off your server —
  but any CORS-blocked endpoint still falls back to your proxy (and the `/api`
  routes remain callable by anyone). Use HTTPS and say plainly in your site
  that a fallback request transits your deployment.

## Project Structure

```
src/
├── app/                # Pages (/ , /chat, /compare, /history) and API routes
│   └── api/            # /api/models, /api/chat, /api/compat
├── components/         # App shell, state store, theme, shared UI, tab views
│   └── tabs/           # Tester, chat, compare, history tabs
└── lib/
    ├── api-client.ts   # Browser-direct transport with /api proxy fallback
    └── providers/      # One module per provider family (openai, anthropic, gemini)
```

The browser calls providers directly through `api-client`, which reuses the
provider modules client-side; each module translates the shared request shape
into the provider's native API format and dispatches on `preset` or `url`. The
`/api` routes wrap the same modules and serve as the CORS fallback.

## Development

```bash
npm run dev      # Start dev server with hot reload
npm run build    # Production build
npm start        # Serve the production build
npm run lint     # Lint with ESLint (eslint-config-next)
```

## Deployment

**Vercel (recommended):** import the repo — the framework preset picks up
`next` automatically. No build command or environment variables are required.

**Self-hosted:**

```bash
npm run build
npm start
```

## Contributing

Contributions are welcome. To propose a change:

1. Fork the repository and create a branch from `main`.
2. Make your change with a clear, focused commit (`git commit -s` is
   appreciated).
3. Ensure `npm run build` and `npm run lint` pass.
4. Open a pull request describing the problem and the solution.

For larger ideas, consider opening an issue first to align on scope.

## License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for the full
text. Copyright (c) 2026 Andika Kurniawan.
