import { describe, it, expect, vi, beforeEach } from "vitest";

describe("voice adapters", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("VOLC_TTS_APP_KEY", "test-app");
    vi.stubEnv("VOLC_TTS_ACCESS_KEY", "test-access");
    vi.stubEnv("VOLC_ASR_RESOURCE_ID", "test-resource");
    vi.stubEnv("E2E_MOCK_MODE", "");
  });

  it("transcribe sends to Volcano ASR and returns text", async () => {
    const { transcribe } = await import("@/lib/voice/asr");
    const fakeFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ result: { text: "你好世界" } }),
    });

    const wav = Buffer.alloc(4000, 0);
    const result = await transcribe(wav, "audio/wav", fakeFetch as unknown as typeof fetch);
    expect(result).toBe("你好世界");
    expect(fakeFetch).toHaveBeenCalledOnce();
    const url = fakeFetch.mock.calls[0][0];
    expect(url).toContain("openspeech.bytedance.com");
  });

  it("transcribe returns empty for short audio", async () => {
    const { transcribe } = await import("@/lib/voice/asr");
    const fakeFetch = vi.fn();
    const result = await transcribe(Buffer.alloc(2999), "audio/wav", fakeFetch as unknown as typeof fetch);
    expect(result).toBe("");
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it("synthesize returns mp3 buffer", async () => {
    const { synthesize } = await import("@/lib/voice/tts");
    const audioB64 = Buffer.from("fake-audio").toString("base64");
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({ code: 0, data: audioB64 }) +
            "\n" +
            JSON.stringify({ code: 20000000 }),
        ),
    });

    const buf = await synthesize("你好", fakeFetch as unknown as typeof fetch);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("synthesize throws VOICE_UNAVAILABLE on error", async () => {
    const { synthesize } = await import("@/lib/voice/tts");
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    await expect(synthesize("你好", fakeFetch as unknown as typeof fetch)).rejects.toThrow(
      "语音服务暂时不可用",
    );
  });

  it("mock mode returns mock responses without calling fetch", async () => {
    vi.stubEnv("E2E_MOCK_MODE", "true");
    const { transcribe } = await import("@/lib/voice/asr");
    const { synthesize } = await import("@/lib/voice/tts");
    const fakeFetch = vi.fn();

    const text = await transcribe(Buffer.alloc(4000), "audio/wav", fakeFetch as unknown as typeof fetch);
    expect(text).toContain("模拟转写");

    const mp3 = await synthesize("你好", fakeFetch as unknown as typeof fetch);
    expect(mp3.length).toBeGreaterThan(0);

    expect(fakeFetch).not.toHaveBeenCalled();
  });
});
