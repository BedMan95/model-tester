import type {
  ChatMessage,
  ChatRequest,
  CompatResult,
  Metrics,
  ModelsRequest,
} from "@/lib/types";
import { GEMINI_API_VERSION, approxTokens, isLimitError, makeMetrics, toApiError } from "./shared";

const API = "https://generativelanguage.googleapis.com";

function guardKey(key?: string) {
  if (!key) throw toApiError(new Error("Gemini API key is required"));
}

function baseUrl(req: { url?: string }): string {
  const u = (req.url || "").trim();
  if (u && u.includes("generativelanguage.googleapis.com"))
    return u.replace(/\/$/, "");
  return API;
}

function modelId(model: string, req: { preset?: string }): string {
  // Accept full ("gemini-1.5-flash") or bare ("1.5-flash"); never double-prefix.
  return model.startsWith("gemini") ? model : `gemini-${model}`;
}

/** Gemini's model catalog lives in a separate REST endpoint, not /v1/models. */
export async function listModels(
  req: ModelsRequest,
  timeout = 10_000,
): Promise<string[]> {
  guardKey(req.key);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(
      `${baseUrl(req)}/${GEMINI_API_VERSION}/models?key=${encodeURIComponent(req.key!)}`,
      { signal: ctrl.signal },
    );
    const data = await res.json();
    if (!res.ok) {
      throw toApiError(
        new Error(data?.error?.message || `HTTP ${res.status} ${res.statusText}`),
      );
    }
    return (data.models ?? [])
      .map((m: { name: string }) => m.name?.replace(/^models\//, ""))
      .filter(Boolean);
  } finally {
    clearTimeout(timer);
  }
}

export interface CompletionCallbacks {
  onChunk: (text: string) => void;
  signal?: AbortSignal;
}

function geminiMessages(messages: ChatMessage[], sysPrompt?: string) {
  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    });
  }
  return {
    systemInstruction: sysPrompt ? { parts: [{ text: sysPrompt }] } : undefined,
    contents,
  };
}

/**
 * Native streaming generation with real time-to-first-token — Gemini's
 * generateContentSSE endpoint emits partial responses as they arrive.
 */
export async function completion(
  req: ChatRequest,
  callbacks: CompletionCallbacks,
): Promise<{ reply: string; metrics: Metrics }> {
  guardKey(req.key);
  const messages = req.messages?.length
    ? req.messages
    : [{ role: "user" as const, content: req.userPrompt || "Reply with exactly: OK" }];
  const system = req.messages?.find((m) => m.role === "system")?.content || req.sysPrompt;
  const { systemInstruction, contents } = geminiMessages(messages, system);

  const body = {
    systemInstruction,
    contents,
    generationConfig: {
      temperature: req.temp ?? 0.7,
      topP: req.topP ?? 1,
      maxOutputTokens: req.maxTokens || 2048,
    },
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), req.timeoutMs || 30_000);
  const t0 = Date.now();
  let ttft = 0;
  let reply = "";
  let usageTokens: number | null = null;

  try {
    const res = await fetch(
      `${baseUrl(req)}/${GEMINI_API_VERSION}/models/${encodeURIComponent(
        modelId(req.model || "", req),
      )}:generateContent?alt=sse&key=${encodeURIComponent(req.key!)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      },
    );

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
        const data = line.slice(5).trim();
        let payload: {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
          usageMetadata?: { candidateTokenCount?: number };
        };
        try {
          payload = JSON.parse(data);
        } catch {
          continue;
        }
        const text =
          payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join(
            "",
          ) ?? "";
        if (text) {
          if (!ttft) ttft = Date.now() - t0;
          reply += text;
          callbacks.onChunk(text);
        }
        if (payload.usageMetadata?.candidateTokenCount != null) {
          usageTokens = payload.usageMetadata.candidateTokenCount;
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
 * Gemini capability probing.
 *
 * Tools and JSON are tested natively (functionDeclarations,
 * responseMimeType = application/json) instead of OpenAI-shaped params the
 * API rejects.
 */
export async function compatCheck(
  req: ChatRequest,
  timeout = 6_000,
): Promise<CompatResult> {
  guardKey(req.key);
  const base = baseUrl(req);
  const model = modelId(req.model || "", req);
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
      const res = await fetch(
        `${base}/${GEMINI_API_VERSION}/models/${encodeURIComponent(
          model,
        )}:generateContent?key=${encodeURIComponent(req.key!)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        },
      );
      return { ok: res.ok, data: await res.json().catch(() => null) };
    } finally {
      clearTimeout(timer);
    }
  };

  // Chat + tools + JSON in one call.
  try {
    const { ok, data } = await post({
      contents: [{ role: "user", parts: [{ text: "Call the function f." }] }],
      tools: [
        {
          functionDeclarations: [
            { name: "f", description: "Test function", parameters: { type: "OBJECT" } },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 32,
        responseMimeType: "application/json",
      },
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
      const cand = data.candidates?.[0];
      const parts = (cand?.content?.parts ?? []) as {
        functionCall?: unknown;
        text?: string;
      }[];
      out.tools = parts.some((p) => p.functionCall) ? "ok" : "fail";
      out.json = (parts.map((p) => p.text ?? "").join("").trim().startsWith("{"))
        ? "ok"
        : "fail";
    }
  } catch (e) {
    const st: CompatResult["chat"] = isLimitError((e as Error).message)
      ? "limit"
      : "fail";
    out.chat = st;
    out.tools = st;
    out.json = st;
  }

  // Streaming — a 200 on the SSE variant confirms support.
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch(
      `${base}/${GEMINI_API_VERSION}/models/${encodeURIComponent(
        model,
      )}:generateContent?alt=sse&key=${encodeURIComponent(req.key!)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "hi" }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
        signal: ctrl.signal,
      },
    );
    clearTimeout(timer);
    if (res.ok) {
      out.stream = "ok";
    } else {
      const data = await res.json().catch(() => null);
      out.stream = isLimitError(data?.error?.message) ? "limit" : "fail";
    }
    res.body?.cancel();
  } catch (e) {
    out.stream = isLimitError((e as Error).message) ? "limit" : "fail";
  }

  // Vision.
  try {
    const { ok, data } = await post({
      contents: [
        {
          role: "user",
          parts: [
            { text: "Describe in one word." },
            {
              inlineData: {
                mimeType: "image/png",
                data: TINY_PNG_BASE64,
              },
            },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 8 },
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

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
