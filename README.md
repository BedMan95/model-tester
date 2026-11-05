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
| Provider SDK | OpenAI SDK (compat routes), native REST for Anthropic / Gemini |

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

## Project Structure

```
src/
├── app/                # Pages (/ , /chat, /compare, /history) and API routes
│   └── api/            # /api/models, /api/chat, /api/compat
├── components/         # App shell, state store, theme, shared UI, tab views
│   └── tabs/           # Tester, chat, compare, history tabs
└── lib/
    └── providers/      # One module per provider family (openai, anthropic, gemini)
```

Routes dispatch on the request's `preset` or `url`; each provider module
translates the shared request shape into the provider's native API format.

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
