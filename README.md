# AI Model Tester

A lightweight, modern web app built with **Node.js** and **Express** to test OpenAI-compatible endpoints, verify model availability, and run capability/compatibility checks (Chat, Tools, JSON mode, Streaming, Vision).

---

## Features

- **Model Discovery**: Fetch all available models from an OpenAI-compatible provider.
- **Batch Parallel Testing**: Test models concurrently in configurable batches (default 5 models at a time) with short timeouts (4s).
- **Status Badges**:
  - `Work (OK)` (Green): Model responded successfully.
  - `Limit Exceeded` (Amber): Model quota or rate limit exceeded.
  - `Failed` / `Failed (Timeout)` (Red): Error or timeout.
- **Capability / Compatibility Test**:
  - Test Chat, Tools / Function Calling, Structured JSON output, Response Streaming, and Vision support per model.
- **One-Click Copy**: Fast "Copy Model ID" button.
- **Modern UI**: Styled with Tailwind CSS for a clean layout.

---

## Prerequisites

- **Node.js** v18+
- **npm**

---

## Quick Start

1. **Clone & Install**:
   ```bash
   git clone https://github.com/BedMan95/model-tester.git
   cd model-tester
   npm install
   ```

2. **Run Server**:
   ```bash
   node server.js
   ```

3. **Open Browser**:
   Navigate to `http://localhost:3000`.

---

## Tech Stack

- **Backend**: Node.js, Express, `openai` SDK (`^4.50.0`)
- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript

---

## License

MIT
