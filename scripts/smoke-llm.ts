async function main() {
  process.loadEnvFile(".env.local");

  const { getBananaRouterConfig } = await import("../lib/llm/config");
  const { extractText, requestGenerateContent } = await import(
    "../lib/llm/gemini-http"
  );
  const { generateJson } = await import("../lib/llm/generate-json");
  const { LlmError } = await import("../lib/llm/types");
  type GeminiContent = import("../lib/llm/gemini-http").GeminiContent;

  const TOOL = {
    name: "get_current_step",
    description: "获取用户当前所在的步骤",
    parameters: { type: "object", properties: {} },
  };

  function logLine(fields: {
    step: string;
    status: number | string;
    ok: boolean;
    latencyMs: number;
    errorCategory: string | null;
    finishReason: string | null;
    hasFunctionCall: boolean;
    hasThoughtSignature: boolean;
  }) {
    console.log(
      [
        fields.step,
        `HTTP ${fields.status}`,
        fields.ok ? "ok" : "fail",
        `${fields.latencyMs}ms`,
        fields.errorCategory ?? "-",
        fields.finishReason ?? "-",
        fields.hasFunctionCall ? "functionCall=yes" : "functionCall=no",
        fields.hasThoughtSignature
          ? "thoughtSignature=yes"
          : "thoughtSignature=no",
      ].join(" / "),
    );
  }

  function httpStatusFromError(error: unknown): number | string {
    if (!(error instanceof LlmError)) return "?";
    const m = error.message.match(/HTTP (\d+)/);
    if (m) return Number(m[1]);
    if (error.category === "unauthorized") return 401;
    if (error.category === "rate_limited") return 429;
    if (error.category === "timeout") return "timeout";
    if (error.category === "network_error") return "network";
    return "?";
  }

  function firstFunctionCallPart(
    content: GeminiContent | undefined,
  ): Record<string, unknown> | null {
    const parts = content?.parts;
    if (!Array.isArray(parts)) return null;
    for (const part of parts) {
      if (part && typeof part === "object" && "functionCall" in part) {
        return part as Record<string, unknown>;
      }
    }
    return null;
  }

  function stripThoughtSignatures(content: GeminiContent): GeminiContent {
    return {
      ...content,
      parts: (content.parts ?? []).map((part) => {
        const next = { ...part };
        delete next.thoughtSignature;
        return next;
      }),
    };
  }

  const config = getBananaRouterConfig();
  let calls = 0;
  const budget = () => {
    if (calls >= 6) throw new Error("exceeded 6 real LLM calls");
    calls += 1;
  };

  // (a) plain text
  {
    budget();
    const started = Date.now();
    try {
      const { candidate } = await requestGenerateContent({
        config,
        timeoutMs: 30000,
        body: {
          contents: [{ role: "user", parts: [{ text: "用一句话打个招呼" }] }],
          generationConfig: {
            maxOutputTokens: 64,
            thinkingConfig: { thinkingLevel: "minimal" },
          },
        },
      });
      const text = extractText(candidate.content);
      const ok = text.length > 0;
      logLine({
        step: "a",
        status: 200,
        ok,
        latencyMs: Date.now() - started,
        errorCategory: null,
        finishReason: candidate.finishReason ?? null,
        hasFunctionCall: false,
        hasThoughtSignature: false,
      });
      if (!ok) process.exit(1);
    } catch (error) {
      logLine({
        step: "a",
        status: httpStatusFromError(error),
        ok: false,
        latencyMs: Date.now() - started,
        errorCategory: error instanceof LlmError ? error.category : "unknown",
        finishReason: null,
        hasFunctionCall: false,
        hasThoughtSignature: false,
      });
      if (error instanceof LlmError && error.category === "unauthorized") {
        console.error("鉴权失败，请检查 Key");
      }
      process.exit(1);
    }
  }

  // (b) tool call with thoughtSignature — up to 2 attempts
  let modelContent: GeminiContent | null = null;
  let functionCallName = "get_current_step";
  {
    let gotCall = false;
    let gotSig = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      budget();
      const started = Date.now();
      try {
        const { candidate } = await requestGenerateContent({
          config,
          timeoutMs: 30000,
          body: {
            systemInstruction: {
              parts: [
                {
                  text: "你是助手。用户询问当前步骤时必须调用 get_current_step 工具，不要直接回答。",
                },
              ],
            },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: "请调用 get_current_step 工具告诉我现在在哪一步",
                  },
                ],
              },
            ],
            tools: [{ functionDeclarations: [TOOL] }],
            toolConfig: { functionCallingConfig: { mode: "AUTO" } },
            generationConfig: {
              maxOutputTokens: 1024,
              thinkingConfig: { thinkingLevel: "minimal" },
            },
          },
        });

        const part = firstFunctionCallPart(candidate.content);
        const hasFunctionCall = part !== null;
        const hasThoughtSignature =
          hasFunctionCall && typeof part.thoughtSignature === "string";
        logLine({
          step: `b${attempt}`,
          status: 200,
          ok: hasFunctionCall && hasThoughtSignature,
          latencyMs: Date.now() - started,
          errorCategory: null,
          finishReason: candidate.finishReason ?? null,
          hasFunctionCall,
          hasThoughtSignature,
        });

        if (hasFunctionCall && hasThoughtSignature && candidate.content) {
          modelContent = candidate.content;
          const fc = part.functionCall as { name?: string };
          if (fc?.name) functionCallName = fc.name;
          gotCall = true;
          gotSig = true;
          break;
        }
        if (hasFunctionCall) gotCall = true;
        if (hasThoughtSignature) gotSig = true;
      } catch (error) {
        logLine({
          step: `b${attempt}`,
          status: httpStatusFromError(error),
          ok: false,
          latencyMs: Date.now() - started,
          errorCategory: error instanceof LlmError ? error.category : "unknown",
          finishReason: null,
          hasFunctionCall: false,
          hasThoughtSignature: false,
        });
        if (error instanceof LlmError && error.category === "unauthorized") {
          console.error("鉴权失败，请检查 Key");
          process.exit(1);
        }
      }
    }

    if (!gotCall || !gotSig || !modelContent) {
      console.error(
        "停下：(b) 未得到带 thoughtSignature 的 functionCall，需用户决定是否切到 §18",
      );
      process.exit(1);
    }
  }

  // (c) echo content + functionResponse
  {
    budget();
    const started = Date.now();
    try {
      const { candidate } = await requestGenerateContent({
        config,
        timeoutMs: 30000,
        body: {
          systemInstruction: {
            parts: [{ text: "根据工具结果用一句话告诉用户当前步骤。" }],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: "请调用 get_current_step 工具告诉我现在在哪一步",
                },
              ],
            },
            modelContent,
            {
              role: "user",
              parts: [
                {
                  functionResponse: {
                    name: functionCallName,
                    response: { step: "profile", ok: true },
                  },
                },
              ],
            },
          ],
          tools: [{ functionDeclarations: [TOOL] }],
          toolConfig: { functionCallingConfig: { mode: "NONE" } },
          generationConfig: {
            maxOutputTokens: 1024,
            thinkingConfig: { thinkingLevel: "minimal" },
          },
        },
      });
      const text = extractText(candidate.content);
      const ok = text.length > 0;
      logLine({
        step: "c",
        status: 200,
        ok,
        latencyMs: Date.now() - started,
        errorCategory: null,
        finishReason: candidate.finishReason ?? null,
        hasFunctionCall: false,
        hasThoughtSignature: false,
      });
      if (!ok) {
        console.error("停下：(c) 无最终文字");
        process.exit(1);
      }
    } catch (error) {
      const status = httpStatusFromError(error);
      logLine({
        step: "c",
        status,
        ok: false,
        latencyMs: Date.now() - started,
        errorCategory: error instanceof LlmError ? error.category : "unknown",
        finishReason: null,
        hasFunctionCall: false,
        hasThoughtSignature: false,
      });
      if (status === 400) {
        console.error(
          "停下：(c) 带着签名仍然 400，需用户决定是否切到 §18",
        );
      }
      process.exit(1);
    }
  }

  // (d) same as (c) but strip thoughtSignature — expect 400
  {
    budget();
    const started = Date.now();
    try {
      await requestGenerateContent({
        config,
        timeoutMs: 30000,
        body: {
          systemInstruction: {
            parts: [{ text: "根据工具结果用一句话告诉用户当前步骤。" }],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: "请调用 get_current_step 工具告诉我现在在哪一步",
                },
              ],
            },
            stripThoughtSignatures(modelContent),
            {
              role: "user",
              parts: [
                {
                  functionResponse: {
                    name: functionCallName,
                    response: { step: "profile", ok: true },
                  },
                },
              ],
            },
          ],
          tools: [{ functionDeclarations: [TOOL] }],
          toolConfig: { functionCallingConfig: { mode: "NONE" } },
          generationConfig: {
            maxOutputTokens: 1024,
            thinkingConfig: { thinkingLevel: "minimal" },
          },
        },
      });
      logLine({
        step: "d",
        status: 200,
        ok: true,
        latencyMs: Date.now() - started,
        errorCategory: null,
        finishReason: "STOP",
        hasFunctionCall: false,
        hasThoughtSignature: false,
      });
      console.log("注：(d) 预期 400，实际 200，仅记录现象，不算失败");
    } catch (error) {
      const status = httpStatusFromError(error);
      logLine({
        step: "d",
        status,
        ok: status === 400,
        latencyMs: Date.now() - started,
        errorCategory: error instanceof LlmError ? error.category : "unknown",
        finishReason: null,
        hasFunctionCall: false,
        hasThoughtSignature: false,
      });
    }
  }

  // (e) JSON via generateJson
  {
    budget();
    const started = Date.now();
    try {
      const { data } = await generateJson<{ ok: boolean }>({
        purpose: "smoke",
        system: '只输出一个 JSON 对象，例如 {"ok":true}。',
        user: '请返回 json：{"ok":true}',
        maxOutputTokens: 256,
        temperature: 0,
        timeoutMs: 30000,
        retryDelayMs: 0,
      });
      const ok = data !== null && typeof data === "object";
      logLine({
        step: "e",
        status: 200,
        ok,
        latencyMs: Date.now() - started,
        errorCategory: null,
        finishReason: "STOP",
        hasFunctionCall: false,
        hasThoughtSignature: false,
      });
      if (!ok) process.exit(1);
    } catch (error) {
      logLine({
        step: "e",
        status: httpStatusFromError(error),
        ok: false,
        latencyMs: Date.now() - started,
        errorCategory: error instanceof LlmError ? error.category : "unknown",
        finishReason: null,
        hasFunctionCall: false,
        hasThoughtSignature: false,
      });
      process.exit(1);
    }
  }

  console.log(`done calls=${calls}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "smoke failed");
  process.exit(1);
});
