import type { CompatRequest } from "@/lib/types";
import { compatCheck, toClientError } from "@/lib/providers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CompatRequest;
    const result = await compatCheck(body);
    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = toClientError(e);
    const status = /required|missing/i.test(message) ? 400 : 502;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
