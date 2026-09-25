import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  answerAllInterviewViaApi,
  answerAllQuizViaApi,
  confirmProfileViaApi,
  loginViaApi,
  startConversation,
  waitForStage,
} from "./helpers";

const resumePath = path.join(
  process.cwd(),
  "tests/fixtures/.tmp-resume.docx",
);

test.describe("resume and report API", () => {
  test("uploads docx and prefills profile_form", async ({ request }) => {
    const start = await startConversation(request);
    const res = await request.post("/api/resume", {
      multipart: {
        conversationId: start.conversation.id,
        file: {
          name: ".tmp-resume.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer: fs.readFileSync(resumePath),
        },
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const card = body.messages.find(
      (m: { content: { card?: { type: string } } }) =>
        m.content.card?.type === "profile_form",
    );
    expect(card.content.card.resume.fileName).toBe(".tmp-resume.docx");
    expect(card.content.card.draft.education).toBe("bachelor");
  });

  test("rejects txt file and upload in quiz stage", async ({ request }) => {
    const start = await startConversation(request);
    const txt = await request.post("/api/resume", {
      multipart: {
        conversationId: start.conversation.id,
        file: {
          name: "bad.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("hello"),
        },
      },
    });
    expect(txt.status()).toBe(415);
    expect((await txt.json()).error.code).toBe("UNSUPPORTED_FILE");

    await confirmProfileViaApi(
      request,
      start.conversation.id,
      start.state.activeTaskId,
    );
    const quizUpload = await request.post("/api/resume", {
      multipart: {
        conversationId: start.conversation.id,
        file: {
          name: ".tmp-resume.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer: fs.readFileSync(resumePath),
        },
      },
    });
    expect(quizUpload.status()).toBe(409);
    expect((await quizUpload.json()).error.code).toBe("STAGE_MISMATCH");
  });

  test("GET report returns overview; other user gets 404", async ({
    request,
    browser,
  }) => {
    const start = await startConversation(request);
    const conversationId = start.conversation.id;
    const taskId = start.state.activeTaskId;

    await confirmProfileViaApi(request, conversationId, taskId);
    await answerAllQuizViaApi(request, conversationId, taskId);
    await answerAllInterviewViaApi(request, conversationId, taskId);
    await loginViaApi(request);

    await request.post("/api/action", {
      data: {
        conversationId,
        action: { type: "generate_report", taskId },
      },
    });
    const ready = await waitForStage(
      request,
      conversationId,
      "report_ready",
      15_000,
    );
    const reportUuid = ready.state.reportUuid;
    expect(reportUuid).toBeTruthy();

    const reportRes = await request.get(`/api/report/${reportUuid}`);
    expect(reportRes.status()).toBe(200);
    const reportBody = await reportRes.json();
    expect(reportBody.report.overview).toBeTruthy();

    const other = await browser.newContext();
    const foreign = await other.request.get(`/api/report/${reportUuid}`);
    expect(foreign.status()).toBe(404);
    await other.close();
  });
});
