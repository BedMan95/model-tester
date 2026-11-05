import type OpenAI from "openai";
import type {
  ChatRequest,
  CompatResult,
  Metrics,
  ModelsRequest,
} from "@/lib/types";
import {
  approxTokens,
  isLimitError,
  makeClient,
  makeMetrics,
  normalizeMessages,
  toApiError,
  type CompletionCallbacks,
} from "./shared";

export type { CompletionCallbacks };

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

export function openaiBaseURL(req: { url?: string; preset?: string }): string {
  const url = (req.url || "").trim();
  if (url) return url.replace(/\/$/, "");
  // ponytail: only the OpenAI family falls back to the public endpoint; every
  // other preset requires an explicit base URL.
  return "https://api.openai.com/v1";
}

function guardUrl(url: string, key: string): void {
  if (!url) throw toApiError(new Error("Base URL is required"));
  if (!key) throw toApiError(new Error("API key is required for this endpoint"));
}

/** Extract usage tokens from a non-streaming completion. */
function usageTokens(r: OpenAI.Chat.Completions.ChatCompletion): number {
  return r.usage?.completion_tokens ?? approxTokens(contentOf(r));
}

function contentOf(
  r: OpenAI.Chat.Completions.ChatCompletion,
): string {
  return r.choices[0]?.message?.content ?? "";
}

export async function listModels(
  req: ModelsRequest,
  timeout = 10_000,
): Promise<string[]> {
  const baseURL = openaiBaseURL(req);
  guardUrl(baseURL, req.key || "");
  const client = await makeClient(baseURL, req.key || "", timeout);
  const list = await client.models.list();
  const models: string[] = [];
  for await (const m of list) {
    models.push(typeof m === "string" ? m : (m.id || String(m)));
  }
  return models;
}

export async function completion(
  req: ChatRequest,
  callbacks: CompletionCallbacks,
): Promise<{ reply: string; metrics: Metrics }> {
  const baseURL = openaiBaseURL(req);
  guardUrl(baseURL, req.key || "");
  const timeout = req.timeoutMs || 30_000;
  const client = await makeClient(baseURL, req.key || "", timeout);
  const t0 = Date.now();
  let ttft = 0;
  let reply = "";

  const stream = await client.chat.completions.create(
    {
      model: req.model || "",
      messages: normalizeMessages(req),
      temperature: req.temp ?? 0.7,
      top_p: req.topP ?? 1,
      max_tokens: req.maxTokens || 2048,
      stream: true,
      stream_options: { include_usage: true },
    },
    { signal: callbacks.signal },
  );

  let usageTokens: number | null = null;

  for await (const chunk of stream) {
    if (chunk.usage) usageTokens = chunk.usage.completion_tokens ?? null;
    const content = chunk.choices[0]?.delta?.content || "";
    if (!content) continue;
    if (!ttft) ttft = Date.now() - t0;
    reply += content;
    callbacks.onChunk(content);
  }

  return {
    reply,
    metrics: makeMetrics(t0, ttft, usageTokens ?? approxTokens(reply)),
  };
}

export async function compatCheck(
  req: ChatRequest,
  timeout = 6_000,
): Promise<CompatResult> {
  const baseURL = openaiBaseURL(req);
  guardUrl(baseURL, req.key || "");
  const client = await makeClient(baseURL, req.key || "", timeout);
  const model = req.model || "";
  const out: CompatResult = {
    chat: "fail",
    tools: "fail",
    json: "fail",
    stream: "fail",
    vision: "fail",
  };

  // Chat + tools + JSON in one call.
  try {
    const r = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Call the function f." }],
      tools: [
        {
          type: "function",
          function: { name: "f", parameters: { type: "object", properties: {} } },
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 32,
    });
    const content = contentOf(r);
    if (isLimitError(content)) {
      out.chat = "limit";
      out.tools = "limit";
      out.json = "limit";
    } else {
      out.chat = "ok";
      out.tools =
        (r.choices[0]?.message?.tool_calls?.length ?? 0) > 0 ||
        content.toLowerCase().includes("f")
          ? "ok"
          : "fail";
      out.json = content.trim().startsWith("{") ? "ok" : "fail";
    }
  } catch (e) {
    const st = isLimitError((e as Error).message) ? "limit" : "fail";
    out.chat = st;
    out.tools = st;
    out.json = st;
  }

  // Streaming.
  try {
    const s = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 5,
      stream: true,
    });
    let hasChunks = false;
    for await (const _ of s) {
      hasChunks = true;
      break;
    }
    out.stream = hasChunks ? "ok" : "fail";
  } catch (e) {
    out.stream = isLimitError((e as Error).message) ? "limit" : "fail";
  }

  // Vision.
  try {
    const r = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe in one word." },
            { type: "image_url", image_url: { url: TINY_PNG } },
          ],
        },
      ],
      max_tokens: 5,
    });
    out.vision = isLimitError(contentOf(r)) ? "limit" : "ok";
  } catch (e) {
    out.vision = isLimitError((e as Error).message) ? "limit" : "fail";
  }

  return out;
}
