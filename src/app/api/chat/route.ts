import type { ChatRequest, StreamEvent } from "@/lib/types";
import { detectProvider, toApiError } from "@/lib/providers/shared";
import * as openai from "@/lib/providers/openai";
import * as anthropic from "@/lib/providers/anthropic";
import * as gemini from "@/lib/providers/gemini";

export const dynamic = "force-dynamic";

/**
 * One endpoint, two wire formats:
 *  - `stream: false` (default) → single JSON body `{reply, metrics}`
 *  - `stream: true` → SSE: `{chunk}` events then a final `{done, metrics}`
 *
 * Preserves the v1 client contract exactly.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as ChatRequest | null;
  if (!body?.model && !body?.userPrompt && !body?.messages) {
    return json({ error: "Missing model" }, 400);
  }

  const provider = detectProvider(body.preset, body.url);
  const runner =
    provider === "anthropic"
      ? anthropic.completion
      : provider === "gemini"
        ? gemini.completion
        : openai.completion;

  if (!body.stream) {
    try {
      const { reply, metrics } = await runner(body, { onChunk: () => {} });
      return json({ reply, metrics });
    } catch (e) {
      const err = toApiError(e);
      const status = /required|missing/i.test(err.message) ? 400 : 502;
      return json({ error: err.message }, status);
    }
  }

  const encoder = new TextEncoder();
  const sse = (ev: StreamEvent): Uint8Array =>
    encoder.encode(`data: ${JSON.stringify(ev)}\n\n`);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const { reply, metrics } = await runner(body!, {
          onChunk: (text) => {
            if (text) controller.enqueue(sse({ chunk: text }));
          },
        });
        controller.enqueue(sse({ done: true, reply, metrics }));
      } catch (e) {
        const err = toApiError(e);
        controller.enqueue(
          sse({
            done: true,
            error:
              err.message.toLowerCase().includes("limit") ||
              err.message.includes("429")
                ? `Limit exceeded: ${err.message}`
                : err.message,
          }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function json(
  data: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
