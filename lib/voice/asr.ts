import { randomUUID } from "crypto";
import { DomainError } from "../errors";

const MIN_AUDIO_SIZE = 3000;

export async function transcribe(
  audioBuffer: Buffer,
  mimeType?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (process.env.E2E_MOCK_MODE === "true") {
    return audioBuffer.byteLength < MIN_AUDIO_SIZE
      ? ""
      : "（模拟转写）我喜欢和人打交道";
  }

  if (audioBuffer.byteLength < MIN_AUDIO_SIZE) return "";

  const appKey = process.env.VOLC_TTS_APP_KEY;
  const accessKey = process.env.VOLC_TTS_ACCESS_KEY;
  const resourceId =
    process.env.VOLC_ASR_RESOURCE_ID || "volc.bigasr.auc_turbo";

  if (!appKey || !accessKey) {
    throw new DomainError("VOICE_UNAVAILABLE");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetchImpl(
      "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-App-Key": appKey,
          "X-Api-Access-Key": accessKey,
          "X-Api-Resource-Id": resourceId,
          "X-Api-Request-Id": randomUUID(),
          "X-Api-Sequence": "-1",
        },
        body: JSON.stringify({
          user: { uid: randomUUID() },
          audio: { data: audioBuffer.toString("base64") },
          request: { model_name: "bigmodel" },
        }),
        signal: controller.signal,
      },
    );

    const data = await response.json();
    if (data?.result?.text) return data.result.text as string;
    return "";
  } catch (err) {
    if (err instanceof DomainError) throw err;
    throw new DomainError("VOICE_UNAVAILABLE");
  } finally {
    clearTimeout(timeoutId);
  }
}
