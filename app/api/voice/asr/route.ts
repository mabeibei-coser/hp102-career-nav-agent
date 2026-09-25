import { NextResponse } from "next/server";
import { transcribe } from "@/lib/voice/asr";
import { toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_AUDIO_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");
    const mimeType = formData.get("mimeType") as string | null;

    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "audio required" } },
        { status: 400 },
      );
    }

    if (audio.size > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "音频文件不能超过 2MB" } },
        { status: 400 },
      );
    }

    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    const text = await transcribe(audioBuffer, mimeType ?? undefined);
    return NextResponse.json({ text });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
