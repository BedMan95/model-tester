import type {
  ChatMessage,
  ChatRequest,
  CompatResult,
  Metrics,
  ModelsRequest,
} from "@/lib/types";
import {
  ANTHROPIC_VERSION,
  approxTokens,
  isLimitError,
  makeMetrics,
  toApiError,
} from "./shared";

const API = "https://api.anthropic.com";
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

export function anthropicBaseURL(req: { url?: string }): string {
  const url = (req.url || "").trim();
  if (!url || url === API) return API;
  return url.replace(/\/$/, "");
}

/**
 * Anthropic native messages format: `system` is a top-level param, not a
 * message, so it is stripped from the array and returned separately.
 */
export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

export function splitSystem(
  messages: ChatMessage[],
): { system?: string; messages: AnthropicMessage[] } {
  const system = messages.find((m) => m.role === "system")?.content;
  const mapped = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  return { system, messages: mapped };
}

function guardKey(key?: string) {
  if (!key) throw toApiError(new Error("Anthropic API key is required"));
}

function authHeaders(key: string): Record<string, string> {
  return {
    "x-api-key": key,
    "anthropic-version": ANTHROPIC_VERSION,
    "content-type": "application/json",
  };
}

/**
 * Fetch the live model catalog.
 *
 * Replaces the v1 hardcoded list of three models, which went stale within
 * weeks of release.
 */
export async function listModels(
  req: ModelsRequest,
  timeout = 10_000,
): Promise<string[]> {
  guardKey(req.key);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${anthropicBaseURL(req)}/v1/models?limit=1000`, {
      headers: authHeaders(req.key!),
      signal: ctrl.signal,
    });
    const data = await res.json();
    if (!res.ok) {
      throw toApiError(
        new Error(
          data?.error?.message || `HTTP ${res.status} ${res.statusText}`,
        ),
      );
    }
    return ((data.data ?? []) as { id: string }[])
      .map((m) => m.id)
      .filter(Boolean);
  } finally {
    clearTimeout(timer);
  }
}

export interface CompletionCallbacks {
  onChunk: (text: string) => void;
  signal?: AbortSignal;
}

/**
 * Native SSE streaming with real time-to-first-token.
 *
 * The v1 branch faked TTFT as `latency * 0.4` and buffered the whole response
 * before emitting anything, so streaming Anthropic was indistinguishable from
 * a batch call.
 */
export async function completion(
  req: ChatRequest,
  callbacks: CompletionCallbacks,
): Promise<{ reply: string; metrics: Metrics }> {
  guardKey(req.key);
  const { system, messages } = splitSystem(
    req.messages?.length
      ? req.messages
      : [{ role: "user", content: req.userPrompt || "Reply with exactly: OK" }],
  );

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), req.timeoutMs || 30_000);
  const t0 = Date.now();
  let ttft = 0;
  let reply = "";
  let usageTokens: number | null = null;

  try {
    const res = await fetch(`${anthropicBaseURL(req)}/v1/messages`, {
      method: "POST",
      headers: authHeaders(req.key!),
      body: JSON.stringify({
        model: req.model || "",
        messages,
        ...(system ? { system } : {}),
        max_tokens: req.maxTokens || 2048,
        temperature: req.temp ?? 0.7,
        top_p: req.topP ?? 1,
        stream: true,
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      throw toApiError(
        new Error(
          errBody?.error?.message || `HTTP ${res.status} ${res.statusText}`,
        ),
      );
    }
    if (!res.body) throw toApiError(new Error("No response body"));

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const raw of events) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }

        if (event.type === "content_block_delta") {
          const delta = event.delta as { type: string; text?: string };
          if (delta.type === "text_delta" && delta.text) {
            if (!ttft) ttft = Date.now() - t0;
            reply += delta.text;
            callbacks.onChunk(delta.text);
          }
        } else if (event.type === "message_delta") {
          const usage = (event as { usage?: { output_tokens?: number } }).usage;
          if (usage?.output_tokens != null) usageTokens = usage.output_tokens;
        }
      }
    }

    return {
      reply,
      metrics: makeMetrics(t0, ttft, usageTokens ?? approxTokens(reply)),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Capability probing using Anthropic-native shapes: `tool_use` content blocks
 * and base64 image sources, instead of OpenAI params the API would reject.
 */
export async function compatCheck(
  req: ChatRequest,
  timeout = 6_000,
): Promise<CompatResult> {
  guardKey(req.key);
  const base = anthropicBaseURL(req);
  const model = req.model || "";
  const headers = authHeaders(req.key!);
  const out: CompatResult = {
    chat: "fail",
    tools: "fail",
    json: "fail",
    stream: "fail",
    vision: "fail",
  };

  const post = async (body: Record<string, unknown>) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(`${base}/v1/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      return { ok: res.ok, data: await res.json().catch(() => null) };
    } finally {
      clearTimeout(timer);
    }
  };

  // Chat + tools + JSON in one call.
  try {
    const { ok, data } = await post({
      model,
      max_tokens: 64,
      messages: [{ role: "user", content: "Call the function f." }],
      tools: [
        {
          name: "f",
          description: "Test function",
          input_schema: { type: "object", properties: {} },
        },
      ],
      system: "Reply with a single valid JSON object.",
    });

    if (!ok) {
      const st: CompatResult["chat"] = isLimitError(data?.error?.message)
        ? "limit"
        : "fail";
      out.chat = st;
      out.tools = st;
      out.json = st;
    } else {
      out.chat = "ok";
      const blocks = (data.content ?? []) as { type: string; text?: string }[];
      out.tools = blocks.some((b) => b.type === "tool_use") ? "ok" : "fail";
      const text = blocks
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join(" ");
      out.json = text.trim().startsWith("{") ? "ok" : "fail";
    }
  } catch (e) {
    const st: CompatResult["chat"] = isLimitError((e as Error).message)
      ? "limit"
      : "fail";
    out.chat = st;
    out.tools = st;
    out.json = st;
  }

  // Streaming — a 200 with an SSE body is enough to confirm support.
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        max_tokens: 5,
        messages: [{ role: "user", content: "hi" }],
        stream: true,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    out.stream = res.ok ? "ok" : isLimitError(await errText(res)) ? "limit" : "fail";
    res.body?.cancel();
  } catch (e) {
    out.stream = isLimitError((e as Error).message) ? "limit" : "fail";
  }

  // Vision.
  try {
    const { ok, data } = await post({
      model,
      max_tokens: 8,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe in one word." },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: TINY_PNG_BASE64,
              },
            },
          ],
        },
      ],
    });
    out.vision = !ok
      ? isLimitError(data?.error?.message)
        ? "limit"
        : "fail"
      : "ok";
  } catch (e) {
    out.vision = isLimitError((e as Error).message) ? "limit" : "fail";
  }

  return out;
}

async function errText(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message ?? "";
  } catch {
    return "";
  }
}
