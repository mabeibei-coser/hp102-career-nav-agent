async function main() {
  process.loadEnvFile(".env.local");

  const { readFileSync } = await import("fs");
  const { resolve } = await import("path");
  const { chatWithTools } = await import("../lib/llm/chat");
  const { getQuestion } = await import("../lib/career/quiz-bank");
  const { toolDefsFor } = await import("../lib/agent/tools");
  const { newId } = await import("../lib/ids");

  type Row = {
    questionId: string;
    text: string;
    expected: string;
  };

  const path = resolve("tests/evals/answer-mapping.jsonl");
  const rows: Row[] = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row);

  if (rows.length !== 25) {
    throw new Error(`expected 25 eval rows, got ${rows.length}`);
  }

  const mapped = rows.filter((r) => r.expected !== "none");
  const noneRows = rows.filter((r) => r.expected === "none");
  if (mapped.length !== 20 || noneRows.length !== 5) {
    throw new Error("expected 20 mapped + 5 none rows");
  }

  const tools = toolDefsFor("quiz").filter(
    (t) => t.name === "record_quiz_answer",
  );
  const conversationId = newId();
  let calls = 0;
  const maxCalls = 50;

  type Result = {
    row: Row;
    called: boolean;
    optionLabel: string | null;
    ok: boolean;
  };
  const results: Result[] = [];

  for (const row of rows) {
    if (calls >= maxCalls) throw new Error("exceeded 50 eval LLM calls");
    calls += 1;

    const q = getQuestion(row.questionId);
    if (!q) throw new Error(`unknown question ${row.questionId}`);

    const system = [
      "你是职业导航助手。当前处于测评阶段。",
      "当用户用文字回答当前测评题，且能明确对应到某一个选项时，调用 record_quiz_answer。",
      "对应不清、在提问、或含糊时不要调用工具。",
      `- 当前题：${q.id}「${q.text}」`,
      `- 选项：${q.options.map((o) => `${o.label}. ${o.text}`).join(" / ")}`,
      "【本阶段你可以做的操作】record_quiz_answer",
    ].join("\n");

    const res = await chatWithTools({
      system,
      history: [{ role: "user", text: row.text }],
      turnState: null,
      tools,
      allowTools: true,
      conversationId,
      step: 1,
      purpose: "eval",
      timeoutMs: 30000,
    });

    const quizCall = res.toolCalls.find((c) => c.name === "record_quiz_answer");
    const optionLabel =
      typeof quizCall?.args?.optionLabel === "string"
        ? quizCall.args.optionLabel
        : null;
    const called = Boolean(quizCall);

    let ok: boolean;
    if (row.expected === "none") {
      ok = !called;
    } else {
      ok = called && optionLabel === row.expected;
    }

    results.push({ row, called, optionLabel, ok });
    const mark = ok ? "PASS" : "FAIL";
    console.log(
      `${mark} ${row.questionId} expected=${row.expected} called=${called} option=${optionLabel ?? "-"}`,
    );
  }

  const mappedResults = results.filter((r) => r.row.expected !== "none");
  const noneResults = results.filter((r) => r.row.expected === "none");
  const mappedOk = mappedResults.filter((r) => r.ok).length;
  const noneOk = noneResults.filter((r) => r.ok).length;
  const mappedAcc = mappedOk / mappedResults.length;
  const noneAcc = noneOk / noneResults.length;

  console.log("---");
  console.log(
    `mapped accuracy: ${(mappedAcc * 100).toFixed(1)}% (${mappedOk}/${mappedResults.length})`,
  );
  console.log(
    `none accuracy: ${(noneAcc * 100).toFixed(1)}% (${noneOk}/${noneResults.length})`,
  );
  console.log(`calls=${calls}`);

  const fails = results.filter((r) => !r.ok);
  if (fails.length > 0) {
    console.log("failures:");
    for (const f of fails) {
      console.log(
        `  ${f.row.questionId} text=${JSON.stringify(f.row.text)} expected=${f.row.expected} got=${f.optionLabel ?? "none"}`,
      );
    }
  }

  const pass = mappedAcc >= 0.9 && noneOk >= 4;
  if (!pass) {
    console.error(
      "评测未达标。请用户决定：①调 Skill/工具描述 ②换更强 Gemini ③切 §18 DeepSeek",
    );
    process.exit(1);
  }
  console.log("eval PASS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "eval failed");
  process.exit(1);
});
