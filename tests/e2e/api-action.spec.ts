import { test, expect } from "@playwright/test";
import { QUIZ_QUESTIONS } from "@/lib/career/quiz-bank";
import {
  answerAllInterviewViaApi,
  answerAllQuizViaApi,
  confirmProfileViaApi,
  startConversation,
  waitForStage,
} from "./helpers";

test.describe("action API", () => {
  test("confirm_profile advances to quiz with SJT-01 card", async ({
    request,
  }) => {
    const start = await startConversation(request);
    const result = await confirmProfileViaApi(
      request,
      start.conversation.id,
      start.state.activeTaskId,
    );

    expect(result.state.stage).toBe("quiz");
    const last = result.messages[result.messages.length - 1];
    expect(last.content.card).toBeTruthy();
    expect(last.content.card!.type).toBe("quiz_question");
    expect(last.content.card!.questionId).toBe("SJT-01");
  });

  test("full button flow through report generation", async ({ request }) => {
    const start = await startConversation(request);
    const conversationId = start.conversation.id;
    const taskId = start.state.activeTaskId;

    await confirmProfileViaApi(request, conversationId, taskId);
    await answerAllQuizViaApi(request, conversationId, taskId);

    const afterQuiz = await request.get(
      `/api/conversation?conversationId=${conversationId}`,
    );
    const quizBody = await afterQuiz.json();
    const lastQuiz = quizBody.messages[quizBody.messages.length - 1];
    expect(lastQuiz.content.card.type).toBe("interview_question");
    expect(lastQuiz.content.card.questionId).toBe("Q1");

    await answerAllInterviewViaApi(request, conversationId, taskId);

    const afterInterview = await request.get(
      `/api/conversation?conversationId=${conversationId}`,
    );
    const interviewBody = await afterInterview.json();
    const lastInterview =
      interviewBody.messages[interviewBody.messages.length - 1];
    expect(lastInterview.content.card.type).toBe("report_cta");

    const genRes = await request.post("/api/action", {
      data: {
        conversationId,
        action: { type: "generate_report", taskId },
      },
    });
    expect(genRes.status()).toBe(200);
    const genBody = await genRes.json();
    expect(genBody.state.stage).toBe("report_generating");

    const ready = await waitForStage(
      request,
      conversationId,
      "report_ready",
      15_000,
    );
    const last = ready.messages[ready.messages.length - 1];
    expect(last.content.card).toBeTruthy();
    expect(last.content.card!.type).toBe("report_summary");
    expect(last.content.card!.reportUuid).toBeTruthy();
    expect(ready.state.reportUuid).toBeTruthy();
  });

  test("wrong taskId on answer_quiz returns STAGE_MISMATCH", async ({
    request,
  }) => {
    const start = await startConversation(request);
    await confirmProfileViaApi(
      request,
      start.conversation.id,
      start.state.activeTaskId,
    );

    const res = await request.post("/api/action", {
      data: {
        conversationId: start.conversation.id,
        action: {
          type: "answer_quiz",
          taskId: "00000000-0000-4000-8000-000000000099",
          questionId: QUIZ_QUESTIONS[0].id,
          optionLabel: "A",
        },
      },
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).error.code).toBe("STAGE_MISMATCH");
  });
});
