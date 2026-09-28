import type { ChatMessage, ChatRequest, Metrics } from "@/lib/types";

export const LIMIT_HINTS = [
  "prevent abuse of free resources",
  "limit exceeded",
  "rate limit exceeded",
  "rate_limit_exceeded",
  "insufficient quota",
  "quota exceeded",
  "429",
  "requests per minute",
  "tokens per minute",
  "unlock",
  "add credits",
] as const;

export function isLimitError(message: string | undefined | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return LIMIT_HINTS.some((h) => lower.includes(h.toLowerCase()));
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function fmt(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

export function toApiError(err: unknown): ApiError {
  return new ApiError(fmt(err), err);
}

/** Routes a request to the correct provider family from preset or URL. */
export function detectProvider(
  preset?: string,
  url?: string,
): "openai" | "anthropic" | "gemini" {
  if (preset === "anthropic" || url?.includes("anthropic.com")) return "anthropic";
  if (preset === "gemini" || url?.includes("generativelanguage.googleapis.com"))
    return "gemini";
  return "openai";
}

export function makeClient(url: string, key: string, timeout: number) {
  // Lazy import keeps the SDK out of edge cold starts that don't need it.
  const { OpenAI } = require("openai") as typeof import("openai");
  return new OpenAI({ apiKey: key || "dummy", baseURL: url, timeout });
}

/** Normalize legacy sys/user prompts into a messages array. */
export function normalizeMessages(
  req: ChatRequest,
  fallbackUser = "Reply with exactly: OK",
): ChatMessage[] {
  if (req.messages?.length) return req.messages;
  return [
    { role: "system", content: req.sysPrompt || "You are a helpful assistant." },
    { role: "user", content: req.userPrompt || fallbackUser },
  ];
}

/**
 * Approximates output tokens when a provider returns no usage data.
 * Whitespace splitting undercounts CJK and code, so it is only a fallback.
 */
export function approxTokens(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return Math.ceil(t.length / 4);
}

/**
 * Build a Metrics snapshot from real timings.
 * TTFT is the time to the first emitted token; for non-streaming calls pass
 * `latency` so it clamps to the full response time.
 */
export function makeMetrics(
  t0: number,
  ttft: number,
  tokens: number,
): Metrics {
  const latency = Date.now() - t0;
  const safeTokens = Math.max(tokens, 0);
  return {
    ttft: Math.round(Math.min(ttft || latency, latency)),
    latency,
    tokens: safeTokens,
    tps: Number((safeTokens / (latency / 1000 || 1)).toFixed(1)),
  };
}

export const ANTHROPIC_VERSION = "2023-06-01";
export const GEMINI_API_VERSION = "v1beta";
