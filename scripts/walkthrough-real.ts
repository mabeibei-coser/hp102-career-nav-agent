/**
 * T1.44 automated real-model walkthrough (no E2E_MOCK_MODE).
 * Covers: card-style API flow, typed+resume flow, follow-ups, report redline check, llm_calls stats.
 */
process.loadEnvFile(".env.local");

async function main() {
  if (process.env.E2E_MOCK_MODE === "true") {
    throw new Error("E2E_MOCK_MODE must not be true for real walkthrough");
  }

  const { readFileSync, existsSync } = await import("fs");
  const { resolve } = await import("path");
  const { default: Database } = await import("better-sqlite3");
  const { findRedlineWords } = await import("../lib/career/report/redline");
  const { QUIZ_QUESTIONS } = await import("../lib/career/quiz-bank");
  const { COPY } = await import("../lib/career/copy");

  const base = process.env.WALKTHROUGH_BASE_URL ?? "http://localhost:3000";
  const resumePath = resolve("tests/fixtures/.tmp-resume.docx");
  if (!existsSync(resumePath)) {
    throw new Error(`missing resume fixture: ${resumePath}`);
  }

  type Jar = { cookie: string };
  const jar: Jar = { cookie: "" };

  function absorbSetCookie(res: Response) {
    const raw = res.headers.getSetCookie?.() ?? [];
    const fallback = res.headers.get("set-cookie");
    const list = raw.length > 0 ? raw : fallback ? [fallback] : [];
    for (const sc of list) {
      const part = sc.split(";")[0];
      if (part.startsWith("hp102_session=")) {
        jar.cookie = part;
      }
    }
  }

  async function api(
    method: string,
    path: string,
    body?: unknown,
    init?: RequestInit,
  ) {
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (jar.cookie) headers.cookie = jar.cookie;
    if (body !== undefined && !(body instanceof FormData)) {
      headers["content-type"] = "application/json";
    }
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
      ...init,
    });
    absorbSetCookie(res);
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text.slice(0, 200) };
    }
    return { status: res.status, json };
  }

  function log(msg: string) {
    console.log(`[walk] ${msg}`);
  }

  // ---- Flow 1: card-only via actions ----
  log("=== Flow 1: card-only ===");
  let r = await api("GET", "/api/conversation");
  if (r.status !== 200) throw new Error(`conversation ${r.status}`);
  const conv1 = r.json as {
    conversation: { id: string };
    state: { activeTaskId: string; stage: string };
    messages: Array<{ content: { text?: string; card?: { type: string } } }>;
  };
  const c1 = conv1.conversation.id;
  let task1 = conv1.state.activeTaskId;
  const opening = conv1.messages.find((m) => m.content.text === COPY.opening);
  if (!opening) throw new Error("missing opening copy");
  log(`conv1=${c1} stage=${conv1.state.stage}`);

  r = await api("POST", "/api/action", {
    conversationId: c1,
    action: {
      type: "confirm_profile",
      taskId: task1,
      profile: {
        identity: "recent_grad",
        birthDate: "2003-05",
        education: "bachelor",
        workYears: "lt1",
        targetPosition: "行政专员",
      },
    },
  });
  if (r.status !== 200) throw new Error(`confirm_profile ${r.status} ${JSON.stringify(r.json)}`);
  let state = (r.json as { state: { stage: string; activeTaskId: string } }).state;
  if (state.stage !== "quiz") throw new Error(`expected quiz, got ${state.stage}`);
  task1 = state.activeTaskId;
  log("profile confirmed → quiz");

  for (const q of QUIZ_QUESTIONS) {
    r = await api("POST", "/api/action", {
      conversationId: c1,
      action: {
        type: "answer_quiz",
        taskId: task1,
        questionId: q.id,
        optionLabel: "A",
      },
    });
    if (r.status !== 200) throw new Error(`quiz ${q.id} ${r.status}`);
  }
  state = (r.json as { state: { stage: string; activeTaskId: string } }).state;
  if (state.stage !== "interview") throw new Error(`expected interview, got ${state.stage}`);
  task1 = state.activeTaskId;
  log("quiz done → interview");

  for (const qid of ["Q1", "Q2", "Q3", "Q4"] as const) {
    r = await api("POST", "/api/action", {
      conversationId: c1,
      action: {
        type: "answer_interview",
        taskId: task1,
        questionId: qid,
        text: "我喜欢和人打交道，也愿意学习新技能，希望做行政相关工作。",
        inputMethod: "card",
      },
    });
    if (r.status !== 200) throw new Error(`interview ${qid} ${r.status}`);
  }
  state = (r.json as { state: { stage: string; activeTaskId: string } }).state;
  if (state.stage !== "ready_for_report") {
    throw new Error(`expected ready_for_report, got ${state.stage}`);
  }
  task1 = state.activeTaskId;
  log("interview done → ready_for_report");

  const reportStartedAt = Date.now();
  r = await api("POST", "/api/action", {
    conversationId: c1,
    action: { type: "generate_report", taskId: task1 },
  });
  if (r.status !== 200) throw new Error(`generate_report ${r.status}`);
  state = (r.json as { state: { stage: string } }).state;
  if (state.stage !== "report_generating") {
    throw new Error(`expected report_generating, got ${state.stage}`);
  }
  log("report generating…");

  let reportUuid: string | null = null;
  for (let i = 0; i < 60; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    r = await api("GET", `/api/conversation?conversationId=${c1}`);
    const s = (r.json as { state: { stage: string; reportUuid: string | null } })
      .state;
    log(`poll ${i + 1}: stage=${s.stage}`);
    if (s.stage === "report_ready") {
      reportUuid = s.reportUuid;
      break;
    }
    if (s.stage === "report_failed") {
      throw new Error("report_failed in flow 1");
    }
  }
  if (!reportUuid) throw new Error("report timeout (>3min)");
  const reportMs = Date.now() - reportStartedAt;
  log(`report ready uuid=${reportUuid} durationMs=${reportMs}`);

  r = await api("GET", `/api/report/${reportUuid}`);
  if (r.status !== 200) throw new Error(`get report ${r.status}`);
  const reportBody = r.json as {
    report: {
      overview?: unknown;
      strength?: unknown;
      positioning?: unknown;
      resumeDiagnosis?: unknown;
      advice?: unknown;
    };
  };
  const sections = ["overview", "strength", "positioning", "advice"] as const;
  for (const key of sections) {
    if (!(key in reportBody.report) || reportBody.report[key] == null) {
      throw new Error(`missing report section ${key}`);
    }
  }
  // flow1 no resume → resumeDiagnosis should be null
  if (reportBody.report.resumeDiagnosis != null) {
    log("warn: flow1 unexpected resumeDiagnosis present");
  }
  const redlineHits = findRedlineWords(JSON.stringify(reportBody.report));
  if (redlineHits.length > 0) {
    throw new Error(`redline hits: ${redlineHits.join(",")}`);
  }
  const bannedTheory = /MBTI|大五|霍兰德/;
  if (bannedTheory.test(JSON.stringify(reportBody.report))) {
    throw new Error("banned theory terms found");
  }
  log("report sections+redline OK (flow1)");

  // follow-ups
  r = await api("POST", "/api/chat", {
    conversationId: c1,
    text: "报告里我的优势是什么？请根据报告回答。",
  });
  if (r.status !== 200) throw new Error(`followup1 ${r.status} ${JSON.stringify(r.json)}`);
  log("followup1 OK");

  r = await api("POST", "/api/chat", {
    conversationId: c1,
    text: "行动计划里最重要的第一步是什么？",
  });
  if (r.status !== 200) throw new Error(`followup2 ${r.status}`);
  log("followup2 OK");

  r = await api("POST", "/api/chat", {
    conversationId: c1,
    text: "上海应届生有什么就业补贴政策？",
  });
  if (r.status !== 200) throw new Error(`policy ${r.status}`);
  const policyMsgs = (r.json as { messages: Array<{ content: { text?: string } }> })
    .messages;
  const policyText = policyMsgs
    .map((m) => m.content.text ?? "")
    .join("\n");
  if (!/12333/.test(policyText)) {
    log(`warn: policy reply may lack 12333: ${policyText.slice(0, 120)}…`);
  } else {
    log("policy followup mentions 12333");
  }

  // ---- Flow 2: resume + typed answers (partial chat) ----
  log("=== Flow 2: resume + typed ===");
  // new cookie jar for second user/session
  jar.cookie = "";
  r = await api("POST", "/api/conversation/new", {});
  if (r.status !== 200) throw new Error(`new conv ${r.status}`);
  const conv2 = r.json as {
    conversation: { id: string };
    state: { activeTaskId: string };
  };
  const c2 = conv2.conversation.id;
  let task2 = conv2.state.activeTaskId;

  const form = new FormData();
  form.append("conversationId", c2);
  const buf = readFileSync(resumePath);
  form.append(
    "file",
    new Blob([new Uint8Array(buf)], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    ".tmp-resume.docx",
  );
  r = await api("POST", "/api/resume", form);
  if (r.status !== 200) throw new Error(`resume upload ${r.status} ${JSON.stringify(r.json)}`);
  const resumeMsgs = r.json as {
    messages: Array<{
      content: {
        card?: { draft?: { education?: string }; resume?: { fileName?: string }; type?: string };
      };
    }>;
    state: { activeTaskId: string };
  };
  task2 = resumeMsgs.state.activeTaskId;
  const draftEdu = resumeMsgs.messages
    .map((m) => m.content.card?.draft?.education)
    .find(Boolean);
  log(`resume uploaded; draft.education=${draftEdu ?? "?"}`);

  r = await api("POST", "/api/chat", {
    conversationId: c2,
    text: "档案：identity=recent_grad；birthDate=2003-05；education=bachelor；workYears=lt1；targetPosition=行政专员",
  });
  if (r.status !== 200) throw new Error(`typed profile ${r.status}`);

  r = await api("POST", "/api/action", {
    conversationId: c2,
    action: {
      type: "confirm_profile",
      taskId: task2,
      profile: {
        identity: "recent_grad",
        birthDate: "2003-05",
        education: "bachelor",
        workYears: "lt1",
        targetPosition: "行政专员",
      },
    },
  });
  if (r.status !== 200) {
    // task id may have changed after propose
    const view = await api("GET", `/api/conversation?conversationId=${c2}`);
    task2 = (view.json as { state: { activeTaskId: string } }).state.activeTaskId;
    r = await api("POST", "/api/action", {
      conversationId: c2,
      action: {
        type: "confirm_profile",
        taskId: task2,
        profile: {
          identity: "recent_grad",
          birthDate: "2003-05",
          education: "bachelor",
          workYears: "lt1",
          targetPosition: "行政专员",
        },
      },
    });
  }
  if (r.status !== 200) throw new Error(`confirm2 ${r.status} ${JSON.stringify(r.json)}`);
  task2 = (r.json as { state: { activeTaskId: string } }).state.activeTaskId;
  log("flow2 profile confirmed");

  // typed quiz via chat for first 2, rest via buttons to save calls
  for (let i = 0; i < 2; i++) {
    r = await api("POST", "/api/chat", {
      conversationId: c2,
      text: "选A",
    });
    if (r.status !== 200) throw new Error(`typed quiz ${i} ${r.status}`);
  }
  const view2 = await api("GET", `/api/conversation?conversationId=${c2}`);
  task2 = (view2.json as { state: { activeTaskId: string; stage: string } }).state
    .activeTaskId;
  const answered = (
    view2.json as {
      state: { answersByTask: Record<string, { quiz: Record<string, string> }> };
    }
  ).state.answersByTask[task2]?.quiz;
  const answeredIds = new Set(Object.keys(answered ?? {}));
  for (const q of QUIZ_QUESTIONS) {
    if (answeredIds.has(q.id)) continue;
    r = await api("POST", "/api/action", {
      conversationId: c2,
      action: {
        type: "answer_quiz",
        taskId: task2,
        questionId: q.id,
        optionLabel: "B",
      },
    });
    if (r.status !== 200) throw new Error(`quiz2 ${q.id} ${r.status}`);
  }
  state = (r.json as { state: { stage: string; activeTaskId: string } }).state;
  task2 = state.activeTaskId;
  log(`flow2 quiz done stage=${state.stage}`);

  for (const qid of ["Q1", "Q2", "Q3", "Q4"] as const) {
    r = await api("POST", "/api/chat", {
      conversationId: c2,
      text: `回答：我希望下一份工作能发挥沟通能力，做行政或客户相关岗位。`,
    });
    if (r.status !== 200) {
      // fallback card
      r = await api("POST", "/api/action", {
        conversationId: c2,
        action: {
          type: "answer_interview",
          taskId: task2,
          questionId: qid,
          text: "我希望下一份工作能发挥沟通能力，做行政或客户相关岗位。",
          inputMethod: "chat",
        },
      });
    }
    if (r.status !== 200) throw new Error(`interview2 ${qid} ${r.status}`);
    const st = (r.json as { state: { stage: string; activeTaskId: string } }).state;
    task2 = st.activeTaskId;
    if (st.stage === "ready_for_report") break;
  }
  const v3 = await api("GET", `/api/conversation?conversationId=${c2}`);
  state = (v3.json as { state: { stage: string; activeTaskId: string } }).state;
  task2 = state.activeTaskId;
  if (state.stage !== "ready_for_report") {
    throw new Error(`flow2 expected ready_for_report got ${state.stage}`);
  }

  const report2Start = Date.now();
  r = await api("POST", "/api/action", {
    conversationId: c2,
    action: { type: "generate_report", taskId: task2 },
  });
  if (r.status !== 200) throw new Error(`generate2 ${r.status}`);
  let reportUuid2: string | null = null;
  for (let i = 0; i < 60; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    r = await api("GET", `/api/conversation?conversationId=${c2}`);
    const s = (r.json as { state: { stage: string; reportUuid: string | null } })
      .state;
    log(`flow2 poll ${i + 1}: ${s.stage}`);
    if (s.stage === "report_ready") {
      reportUuid2 = s.reportUuid;
      break;
    }
    if (s.stage === "report_failed") throw new Error("flow2 report_failed");
  }
  if (!reportUuid2) throw new Error("flow2 report timeout");
  log(`flow2 report ${reportUuid2} ms=${Date.now() - report2Start}`);

  r = await api("GET", `/api/report/${reportUuid2}`);
  const report2 = (r.json as { report: { resumeDiagnosis: unknown } }).report;
  if (report2.resumeDiagnosis == null) {
    log("warn: flow2 expected resumeDiagnosis when resume uploaded");
  } else {
    log("flow2 resumeDiagnosis present");
  }
  const hits2 = findRedlineWords(JSON.stringify(report2));
  if (hits2.length > 0) throw new Error(`flow2 redline: ${hits2.join(",")}`);
  log("flow2 redline OK");

  // ---- llm_calls stats ----
  const dbPath = process.env.DB_PATH ?? "./data/hp102.db";
  const db = new Database(dbPath, { readonly: true });
  const rows = db
    .prepare(
      `SELECT kind, purpose, ok, error_category, finish_reason, latency_ms
       FROM llm_calls ORDER BY created_at ASC`,
    )
    .all() as Array<{
    kind: string;
    purpose: string;
    ok: number;
    error_category: string | null;
    finish_reason: string | null;
    latency_ms: number;
  }>;
  db.close();

  const chatRows = rows.filter((x) => x.kind === "chat");
  const jsonRows = rows.filter((x) => x.kind === "json");
  const reportRows = rows.filter((x) => x.purpose === "report");
  const failed = rows.filter((x) => !x.ok);
  const latencies = chatRows.map((x) => x.latency_ms).sort((a, b) => a - b);
  const p95 =
    latencies.length === 0
      ? 0
      : latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))];

  const finishDist: Record<string, number> = {};
  for (const x of rows) {
    const k = x.finish_reason ?? "(null)";
    finishDist[k] = (finishDist[k] ?? 0) + 1;
  }
  const errDist: Record<string, number> = {};
  for (const x of failed) {
    const k = x.error_category ?? "(null)";
    errDist[k] = (errDist[k] ?? 0) + 1;
  }

  console.log("--- STATS ---");
  console.log(`llm_calls total=${rows.length} chat=${chatRows.length} json=${jsonRows.length}`);
  console.log(`report purpose calls=${reportRows.length} failed=${failed.length}`);
  console.log(`chat P95 latency_ms=${p95}`);
  console.log(`finish_reason=${JSON.stringify(finishDist)}`);
  console.log(`error_category=${JSON.stringify(errDist)}`);
  console.log(`flow1 report_ms=${reportMs}`);
  console.log("WALKTHROUGH PASS");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
