import type { ChatRequest, CompatRequest } from "@/lib/types";
import { detectProvider, toApiError } from "@/lib/providers/shared";
import * as openai from "@/lib/providers/openai";
import * as anthropic from "@/lib/providers/anthropic";
import * as gemini from "@/lib/providers/gemini";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CompatRequest;
    const provider = detectProvider(body.preset, body.url);
    const check =
      provider === "anthropic"
        ? anthropic.compatCheck
        : provider === "gemini"
          ? gemini.compatCheck
          : openai.compatCheck;
    const result = await check(body as ChatRequest & CompatRequest);
    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const err = toApiError(e);
    const status = /required|missing/i.test(err.message) ? 400 : 502;
    return new Response(JSON.stringify({ error: err.message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
