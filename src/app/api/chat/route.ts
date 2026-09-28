import type { ChatRequest, StreamEvent } from "@/lib/types";
import { completion, toClientError, isLimitError } from "@/lib/providers";

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

  if (!body.stream) {
    try {
      const { reply, metrics } = await completion(body, { onChunk: () => {} });
      return json({ reply, metrics });
    } catch (e) {
      const message = toClientError(e);
      const status = /required|missing/i.test(message) ? 400 : 502;
      return json({ error: message }, status);
    }
  }

  const encoder = new TextEncoder();
  const sse = (ev: StreamEvent): Uint8Array =>
    encoder.encode(`data: ${JSON.stringify(ev)}\n\n`);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const { reply, metrics } = await completion(body!, {
          onChunk: (text) => {
            if (text) controller.enqueue(sse({ chunk: text }));
          },
        });
        controller.enqueue(sse({ done: true, reply, metrics }));
      } catch (e) {
        const message = toClientError(e);
        controller.enqueue(
          sse({
            done: true,
            error: isLimitError(message)
              ? `Limit exceeded: ${message}`
              : message,
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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
