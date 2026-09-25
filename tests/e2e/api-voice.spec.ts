import { test, expect } from "@playwright/test";
import {
  startConversation,
  confirmProfileViaApi,
  answerAllQuizViaApi,
} from "./helpers";

test.describe("voice API", () => {
  test("POST /api/voice/asr returns transcribed text", async ({ request }) => {
    const wav = Buffer.alloc(4000, 0);
    const res = await request.post("/api/voice/asr", {
      multipart: {
        audio: {
          name: "test.wav",
          mimeType: "audio/wav",
          buffer: wav,
        },
        mimeType: "audio/wav",
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.text).toContain("模拟转写");
  });

  test("POST /api/voice/tts returns audio", async ({ request }) => {
    const res = await request.post("/api/voice/tts", {
      data: { text: "你好" },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("audio/mpeg");
  });

  test("POST /api/voice/tts with empty text returns 400", async ({
    request,
  }) => {
    const res = await request.post("/api/voice/tts", {
      data: { text: "" },
    });
    expect(res.status()).toBe(400);
  });
});
