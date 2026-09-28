/** Shared request/response shapes for the tester API. */

export type ProviderPreset =
  | "custom"
  | "openrouter"
  | "groq"
  | "together"
  | "ollama"
  | "lmstudio"
  | "vllm"
  | "anthropic"
  | "gemini";

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

export const PRESETS: Record<ProviderPreset, string> = {
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  together: "https://api.together.xyz/v1",
  ollama: "http://localhost:11434/v1",
  lmstudio: "http://localhost:1234/v1",
  vllm: "http://localhost:8000/v1",
  anthropic: "https://api.anthropic.com",
  gemini: "https://generativelanguage.googleapis.com",
  custom: "",
};

export const PRESET_LABELS: Record<ProviderPreset, string> = {
  custom: "Custom Endpoint",
  openrouter: "OpenRouter",
  groq: "Groq Cloud",
  together: "Together AI",
  ollama: "Ollama (local)",
  lmstudio: "LM Studio (local)",
  vllm: "vLLM / LocalAI",
  anthropic: "Anthropic Claude",
  gemini: "Google Gemini",
};

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
