import { NextResponse } from "next/server";
import { detectProvider, toApiError } from "@/lib/providers/shared";
import * as openai from "@/lib/providers/openai";
import * as anthropic from "@/lib/providers/anthropic";
import * as gemini from "@/lib/providers/gemini";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const provider = detectProvider(body.preset, body.url);
    const models =
      provider === "anthropic"
        ? await anthropic.listModels(body)
        : provider === "gemini"
          ? await gemini.listModels(body)
          : await openai.listModels(body);
    return NextResponse.json({ models });
  } catch (e) {
    const err = toApiError(e);
    // Surface a real 4xx/5xx status only for our own validation errors;
    // upstream provider failures still come back as JSON in the body so the
    // client can display the message inline.
    const status = err.message.includes("required") ? 400 : 502;
    return NextResponse.json({ error: err.message }, { status });
  }
}
