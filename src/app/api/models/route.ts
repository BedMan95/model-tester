import { NextResponse } from "next/server";
import { listModels, toClientError } from "@/lib/providers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const models = await listModels(body);
    return NextResponse.json({ models });
  } catch (e) {
    const message = toClientError(e);
    const status = message.includes("required") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
