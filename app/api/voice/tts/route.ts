import { NextResponse } from "next/server";
import { synthesize } from "@/lib/voice/tts";
import { toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text: unknown = body?.text;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "text required" } },
        { status: 400 },
      );
    }

    const audio = await synthesize(text.trim());
    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.length),
      },
    });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
