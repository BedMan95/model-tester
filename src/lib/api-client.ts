"use client";

/**
 * Client transport layer: browser-direct provider calls with an automatic
 * fallback to the server-side /api proxy when CORS/network rules block the
 * direct attempt. The API key normally never leaves the browser for anything
 * other than the provider itself; on fallback it transits this deployment.
 */
import {
  completion,
  compatCheck,
  listModels,
  toClientError,
} from "@/lib/providers";
import type {
  ChatRequest,
  ChatResponse,
  CompatRequest,
  CompatResult,
  ModelsRequest,
  ModelsResponse,
} from "@/lib/types";

export type TransportMode = "direct" | "proxy";

export interface TransportReport {
  mode: TransportMode;
  at: number;
}

const FORCE_PROXY_KEY = "model_tester_force_proxy";

export function forceProxyEnabled(): boolean {
  try {
    return localStorage.getItem(FORCE_PROXY_KEY) === "true";
  } catch {
    return false;
  }
}

export function setForceProxy(on: boolean): void {
  try {
    localStorage.setItem(FORCE_PROXY_KEY, JSON.stringify(on));
  } catch {
    /* private mode etc. — the UI state works for the session anyway */
  }
}

/**
 * Origins (or preset names, for blank-URL presets) that failed a direct call
 * with CORS/network errors. Once remembered, calls skip the doomed direct
 * attempt entirely instead of paying the preflight failure on every request.
 * "Server proxy" off + reload of the page is not enough to forget them; they
 * are cleared with the app's stored data or via clearRememberedProxies().
 */
const PROXY_ORIGINS_KEY = "model_tester_proxy_origins";

export function requestEndpointKey(req: { url?: string; preset?: string }): string {
  const url = (req.url || "").trim();
  try {
    if (url) return new URL(url).origin;
  } catch {
    /* malformed URL — fall through to preset */
  }
  return `preset:${req.preset || "unknown"}`;
}

function rememberedProxies(): string[] {
  try {
    return JSON.parse(localStorage.getItem(PROXY_ORIGINS_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function isProxyRemembered(key: string): boolean {
  return rememberedProxies().includes(key);
}

function rememberProxyOrigin(key: string): void {
  const list = rememberedProxies();
  if (!list.includes(key)) {
    try {
      localStorage.setItem(PROXY_ORIGINS_KEY, JSON.stringify([...list, key]));
    } catch {
      /* storage blocked — stay slow, still correct */
    }
  }
}

export function clearRememberedProxies(): void {
  try {
    localStorage.removeItem(PROXY_ORIGINS_KEY);
  } catch {
    /* ignore */
  }
}

const listeners = new Set<(r: TransportReport) => void>();

export function subscribeTransport(
  listener: (r: TransportReport) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function report(mode: TransportMode): void {
  const r = { mode, at: Date.now() };
  for (const l of listeners) l(r);
}

/**
 * True when a direct call failed for a reason the proxy might solve (CORS,
 * DNS, mixed content) — never for HTTP-status errors, timeouts, or cancels,
 * which prove the browser could reach the endpoint (or the user stopped it).
 */
export function isCorsOrNetworkFailure(
  e: unknown,
  signal?: AbortSignal,
): boolean {
  if (signal?.aborted) return false;

  let cur: unknown = e;
  for (let depth = 0; cur != null && depth < 3; depth++) {
    const err = cur as Error & { status?: number };
    if (err.name === "AbortError" || err.name === "APIUserAbortError")
      return false;
    if (err instanceof TypeError) return true;
    // OpenAI SDK wraps connection failures as APIConnectionError with no status.
    if (err.name === "APIConnectionError" && err.status === undefined)
      return true;
    if (typeof err.status === "number" || /HTTP \d{3}/.test(err.message))
      return false;
    if (/failed to fetch|networkerror when attempting|load failed|err_network|network request failed/i.test(err.message))
      return true;
    cur = err.cause;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Proxy path — mirrors the previous in-tab fetch code exactly.        */
/* ------------------------------------------------------------------ */

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

function proxyModels(req: ModelsRequest): Promise<ModelsResponse> {
  return postJson<ModelsResponse>("/api/models", req);
}

function proxyCompat(req: CompatRequest): Promise<{ result?: CompatResult; error?: string }> {
  return postJson<{ result?: CompatResult; error?: string }>("/api/compat", req);
}

function proxyChat(
  req: ChatRequest,
  opts?: { onChunk?: (text: string) => void; signal?: AbortSignal },
): Promise<ChatResponse> {
  if (!req.stream)
    return postJson<ChatResponse>("/api/chat", req);

  return streamProxyChat(req, opts);
}

async function streamProxyChat(
  req: ChatRequest,
  opts?: { onChunk?: (text: string) => void; signal?: AbortSignal },
): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal: opts?.signal,
  });

  if (!res.body) return (await res.json()) as ChatResponse;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let error: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const ev = JSON.parse(line.slice(6));
        if (ev.chunk) {
          full += ev.chunk;
          opts?.onChunk?.(ev.chunk);
        }
        if (ev.done) {
          if (ev.error) error = ev.error;
          else if (ev.reply) full = ev.reply;
        }
      } catch {
        /* ignore malformed events, same as before */
      }
    }
  }

  return error ? { error } : { reply: full };
}

/* ------------------------------------------------------------------ */
/* Public API used by the tabs.                                        */
/* ------------------------------------------------------------------ */

function shouldSkipDirect(req: { url?: string; preset?: string }): boolean {
  return forceProxyEnabled() || isProxyRemembered(requestEndpointKey(req));
}

export async function fetchModels(
  req: ModelsRequest,
): Promise<ModelsResponse & { transport: TransportMode }> {
  if (!shouldSkipDirect(req)) {
    try {
      const models = await listModels(req);
      report("direct");
      return { models, transport: "direct" };
    } catch (e) {
      if (!isCorsOrNetworkFailure(e))
        return { error: toClientError(e), transport: "direct" };
      rememberProxyOrigin(requestEndpointKey(req));
    }
  }
  const d = await proxyModels(req);
  report("proxy");
  return { ...d, transport: "proxy" };
}

export async function runChat(
  req: ChatRequest,
  opts?: { onChunk?: (text: string) => void; signal?: AbortSignal },
): Promise<ChatResponse & { transport: TransportMode }> {
  if (!shouldSkipDirect(req)) {
    let started = false;
    try {
      const { reply, metrics } = await completion(req, {
        onChunk: (t) => {
          if (t) {
            started = true;
            opts?.onChunk?.(t);
          }
        },
        signal: opts?.signal,
      });
      report("direct");
      return { reply, metrics, transport: "direct" };
    } catch (e) {
      // Retrying after partial output would duplicate text in the UI.
      if (!started && isCorsOrNetworkFailure(e, opts?.signal)) {
        rememberProxyOrigin(requestEndpointKey(req));
        const d = await proxyChat(req, opts);
        report("proxy");
        return { ...d, transport: "proxy" };
      }
      return { error: toClientError(e), transport: "direct" };
    }
  }
  const d = await proxyChat(req, opts);
  report("proxy");
  return { ...d, transport: "proxy" };
}

export async function runCompat(
  req: CompatRequest,
): Promise<{ result?: CompatResult; error?: string; transport: TransportMode }> {
  if (!shouldSkipDirect(req)) {
    try {
      const result = await compatCheck(req);
      report("direct");
      return { result, transport: "direct" };
    } catch (e) {
      if (!isCorsOrNetworkFailure(e))
        return { error: toClientError(e), transport: "direct" };
      rememberProxyOrigin(requestEndpointKey(req));
    }
  }
  const d = await proxyCompat(req);
  report("proxy");
  return { ...d, transport: "proxy" };
}
