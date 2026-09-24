import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { completeJsonText } from "@/lib/llm/gemini-json";
import { LlmError } from "@/lib/llm/types";

const configEnv = {
  BANANAROUTER_API_KEY: "test-key",
  BANANAROUTER_BASE_URL: "https://api.bananarouter.com",
  BANANAROUTER_MODEL: "gemini-3.1-flash-lite",
};

function assertSafeMessage(error: unknown) {
  expect(error).toBeInstanceOf(LlmError);
  expect((error as LlmError).message).not.toContain("test-key");
}

describe("gemini json", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, configEnv);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("sends the expected Gemini JSON request", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    const result = await completeJsonText({
      system: "S",
      user: "U json",
      maxOutputTokens: 512,
      temperature: 0.2,
      timeoutMs: 1000,
      fetchImpl: async (input, init) => {
        capturedUrl = String(input);
        capturedInit = init;
        return Response.json({
          candidates: [
            {
              content: { parts: [{ text: '{"a":1}' }] },
              finishReason: "STOP",
            },
          ],
        });
      },
    });

    expect(capturedUrl).toBe(
      "https://api.bananarouter.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
    );
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.redirect).toBe("error");
    const headers = new Headers(capturedInit?.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-key");
    expect(headers.get("Content-Type")).toBe("application/json");
    const body = JSON.parse(String(capturedInit?.body));
    expect(body.systemInstruction.parts[0].text).toBe("S");
    expect(body.contents[0].role).toBe("user");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.maxOutputTokens).toBe(512);
    expect(body.generationConfig.thinkingConfig).toBeUndefined();
    expect(result.text).toBe('{"a":1}');
    expect(result.finishReason).toBe("STOP");
  });

  it("classifies HTTP and transport errors safely", async () => {
    const cases: Array<[number | "timeout" | "network" | "bad-json" | "empty" | "blocked", LlmError["category"]]> = [
      [401, "unauthorized"],
      [403, "unauthorized"],
      [429, "rate_limited"],
      [500, "provider_error"],
      [400, "provider_error"],
      ["timeout", "timeout"],
      ["network", "network_error"],
      ["bad-json", "invalid_response"],
      ["empty", "invalid_response"],
      ["blocked", "blocked"],
    ];

    for (const [kind, category] of cases) {
      await expect(
        completeJsonText({
          system: "S",
          user: "U json",
          maxOutputTokens: 512,
          temperature: 0.2,
          timeoutMs: 5,
          fetchImpl: async (_input, init) => {
            if (kind === "timeout") {
              return new Promise((_resolve, reject) => {
                init?.signal?.addEventListener("abort", () =>
                  reject(new DOMException("aborted", "AbortError")),
                );
              });
            }
            if (kind === "network") {
              throw new TypeError("network down");
            }
            if (kind === "bad-json") {
              return new Response("not-json", { status: 200 });
            }
            if (kind === "empty") {
              return Response.json({ candidates: [] });
            }
            if (kind === "blocked") {
              return Response.json({
                promptFeedback: { blockReason: "SAFETY" },
                candidates: [
                  {
                    content: { parts: [{ text: '{"a":1}' }] },
                    finishReason: "SAFETY",
                  },
                ],
              });
            }
            return new Response("secret", { status: kind as number });
          },
        }),
      ).rejects.toSatisfy((error: unknown) => {
        assertSafeMessage(error);
        expect((error as LlmError).category).toBe(category);
        return true;
      });
    }
  });

  it("concatenates split text parts", async () => {
    const result = await completeJsonText({
      system: "S",
      user: "U json",
      maxOutputTokens: 512,
      temperature: 0.2,
      timeoutMs: 1000,
      fetchImpl: async () =>
        Response.json({
          candidates: [
            {
              content: {
                parts: [{ text: '{"a":' }, { text: "1}" }],
              },
              finishReason: "PARTIAL",
            },
          ],
        }),
    });

    expect(result.text).toBe('{"a":1}');
    expect(result.finishReason).toBe("PARTIAL");
  });
});
