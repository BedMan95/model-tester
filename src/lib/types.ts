/** Shared request/response shapes for the tester API. */

/**
 * Provider families the client picks from.
 *
 *  - `openai-compatible` — any OpenAI-protocol endpoint; the user fills in
 *    their own `url` (OpenRouter, Groq, Ollama, Together, LM Studio, vLLM,
 *    a private OpenAI deployment, …). The OpenAI SDK speaks the wire format.
 *  - `anthropic` — Claude API; its own messages wire format.
 *  - `gemini` — Google Gemini; its own REST wire format.
 */
export type ProviderFamily =
  | "openai-compatible"
  | "anthropic"
  | "gemini";

export const PRESETS: Record<ProviderFamily, string> = {
  "openai-compatible": "",
  anthropic: "https://api.anthropic.com",
  gemini: "https://generativelanguage.googleapis.com",
};

export const PRESET_LABELS: Record<ProviderFamily, string> = {
  "openai-compatible": "OpenAI-compatible (custom)",
  anthropic: "Anthropic Claude",
  gemini: "Google Gemini",
};

export type ProviderPreset = ProviderFamily;

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Compact latency/throughput snapshot attached to every completion. */
export interface Metrics {
  /** Time to first token (ms). */
  ttft: number;
  /** Total wall-clock latency (ms). */
  latency: number;
  /** Output tokens measured from the completion itself when available. */
  tokens: number;
  /** Output tokens per second. */
  tps: number;
}

export interface ChatResponse {
  reply?: string;
  metrics?: Metrics;
  error?: string;
}

/** Server-sent event payload used by the streaming chat endpoint. */
export type StreamEvent =
  | { chunk: string }
  | { done: true; reply?: string; metrics?: Metrics; error?: string };

export type CompatStatus = "ok" | "fail" | "limit" | "untested";

export type CompatFeature = "chat" | "tools" | "json" | "stream" | "vision";

export type CompatResult = Record<CompatFeature, CompatStatus>;

export interface ModelsResponse {
  models?: string[];
  error?: string;
}

export interface CompatResponse {
  result: CompatResult;
}

/**
 * Chat request. The client may send either a `messages` array or the legacy
 * `sysPrompt`/`userPrompt` pair, which the server normalizes.
 */
export interface ChatRequest {
  url?: string;
  key?: string;
  preset?: ProviderPreset;
  model?: string;
  messages?: ChatMessage[];
  sysPrompt?: string;
  userPrompt?: string;
  temp?: number;
  topP?: number;
  maxTokens?: number;
  timeoutMs?: number;
  stream?: boolean;
}

export interface ModelsRequest {
  url?: string;
  key?: string;
  preset?: ProviderPreset;
}

export interface CompatRequest {
  url?: string;
  key?: string;
  preset?: ProviderPreset;
  model?: string;
}

/** Client-side status of a model row in the tester grid. */
export type ModelTestStatus = "ok" | "limit" | "fail" | "testing" | "untested";

/** One row of the exportable test-results table. */
export interface TestRecord {
  model: string;
  url: string;
  preset: string;
  status: ModelTestStatus;
  metrics?: Metrics;
  /** Wall-clock timestamp (ISO or epoch ms), recorded by the client. */
  timestamp?: string | number;
}


export const COMPAT_FEATURES: CompatFeature[] = [
  "chat",
  "tools",
  "json",
  "stream",
  "vision",
];

export const COMPAT_LABELS: Record<CompatFeature, string> = {
  chat: "Chat",
  tools: "Tools",
  json: "JSON",
  stream: "Stream",
  vision: "Vision",
};
