import {
  completion as anthropicCompletion,
  compatCheck as anthropicCompat,
  listModels as anthropicList,
} from "./anthropic";
import {
  completion as geminiCompletion,
  compatCheck as geminiCompat,
  listModels as geminiList,
} from "./gemini";
import {
  completion as openaiCompletion,
  compatCheck as openaiCompat,
  listModels as openaiList,
} from "./openai";
import {
  detectProvider,
  isAnthropic,
  toApiError,
  isLimitError,
  type CompletionCallbacks,
} from "./shared";
import type {
  ChatRequest,
  CompatResult,
  CompatRequest,
  Metrics,
  ModelsRequest,
} from "@/lib/types";

export type { CompletionCallbacks };

/**
 * Single dispatch point for the whole app.
 *
 * Requests fall into two families:
 *  - **OpenAI-compatible** (custom endpoints, OpenRouter, Groq, Ollama,
 *    Together, LM Studio, vLLM…) — handled by the `openai` module.
 *  - **Native** — Anthropic and Gemini speak their own wire formats, so they
 *    get dedicated handlers (`anthropic`, `gemini`).
 *
 * Every public function below picks the right handler from the request, so
 * the API routes stay three lines long each.
 */

export async function listModels(req: ModelsRequest): Promise<string[]> {
  if (detectProvider(req.preset, req.url) === "native") {
    return isAnthropic(req.preset, req.url)
      ? anthropicList(req)
      : geminiList(req);
  }
  return openaiList(req);
}

export async function completion(
  req: ChatRequest,
  callbacks: CompletionCallbacks,
): Promise<{ reply: string; metrics: Metrics }> {
  if (detectProvider(req.preset, req.url) === "native") {
    return isAnthropic(req.preset, req.url)
      ? anthropicCompletion(req, callbacks)
      : geminiCompletion(req, callbacks);
  }
  return openaiCompletion(req, callbacks);
}

export async function compatCheck(req: CompatRequest): Promise<CompatResult> {
  if (detectProvider(req.preset, req.url) === "native") {
    return isAnthropic(req.preset, req.url)
      ? anthropicCompat(req as ChatRequest)
      : geminiCompat(req as ChatRequest);
  }
  return openaiCompat(req as ChatRequest);
}

/**
 * Wrap any provider-side error into a plain string the client can render
 * inline, without leaking stack traces.
 */
export function toClientError(e: unknown): string {
  return toApiError(e).message;
}

export { isLimitError };
