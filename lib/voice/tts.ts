import { randomUUID } from "crypto";
import { DomainError } from "../errors";

const DEFAULT_SPEAKER = "zh_female_vv_uranus_bigtts";

const SILENCE_MP3 = Buffer.from(
  "//uQxAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVV",
  "base64",
);

export async function synthesize(
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Buffer> {
  if (process.env.E2E_MOCK_MODE === "true") {
    return SILENCE_MP3;
  }

  const appKey = process.env.VOLC_TTS_APP_KEY;
  const accessKey = process.env.VOLC_TTS_ACCESS_KEY;
  if (!appKey || !accessKey) {
    throw new DomainError("VOICE_UNAVAILABLE");
  }

  const speaker = process.env.VOLC_TTS_SPEAKER ?? DEFAULT_SPEAKER;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetchImpl(
      "https://openspeech.bytedance.com/api/v3/tts/unidirectional",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Api-App-Id": appKey,
          "X-Api-Access-Key": accessKey,
          "X-Api-Resource-Id": "seed-tts-2.0",
          "X-Api-Request-Id": randomUUID(),
        },
        body: JSON.stringify({
          user: { uid: randomUUID() },
          req_params: {
            text,
            speaker,
            audio_params: { format: "mp3", sample_rate: 24000 },
          },
        }),
      },
    );
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);

    const chunks: Buffer[] = [];
    for (const line of (await res.text()).split(/\r?\n/)) {
      if (!line.trim()) continue;
      const data = JSON.parse(line);
      if (data.code !== 0 && data.code !== 20000000) {
        throw new Error(`TTS provider error ${data.code}`);
      }
      if (data.data) chunks.push(Buffer.from(data.data, "base64"));
    }
    const audio = Buffer.concat(chunks);
    if (!audio.length) throw new Error("TTS empty audio");
    return audio;
  } catch (err) {
    if (err instanceof DomainError) throw err;
    throw new DomainError("VOICE_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }
}
