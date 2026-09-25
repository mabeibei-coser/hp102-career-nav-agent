import { APIRequestContext, expect } from "@playwright/test";
import { QUIZ_QUESTIONS } from "@/lib/career/quiz-bank";

type ConversationResponse = {
  conversation: { id: string; title: string };
  messages: Array<{
    id: string;
    role: string;
    content: {
      kind: string;
      text?: string;
      card?: { type: string; taskId: string; [key: string]: unknown };
    };
  }>;
  state: {
    stage: string;
    activeTaskId: string;
    reportUuid: string | null;
  };
};

export async function startConversation(
  request: APIRequestContext,
): Promise<ConversationResponse> {
  const res = await request.get("/api/conversation");
  expect(res.status()).toBe(200);
  return (await res.json()) as ConversationResponse;
}

export async function confirmProfileViaApi(
  request: APIRequestContext,
  conversationId: string,
  taskId: string,
) {
  const res = await request.post("/api/action", {
    data: {
      conversationId,
      action: {
        type: "confirm_profile",
        taskId,
        profile: {
          identity: "recent_grad",
          birthDate: "2003-05",
          education: "bachelor",
          workYears: "lt1",
          targetPosition: "",
        },
      },
    },
  });
  expect(res.status()).toBe(200);
  return (await res.json()) as ConversationResponse;
}

export async function answerAllQuizViaApi(
  request: APIRequestContext,
  conversationId: string,
  taskId: string,
) {
  for (const q of QUIZ_QUESTIONS) {
    const res = await request.post("/api/action", {
      data: {
        conversationId,
        action: {
          type: "answer_quiz",
          taskId,
          questionId: q.id,
          optionLabel: "A",
        },
      },
    });
    expect(res.status()).toBe(200);
  }
}

export async function answerAllInterviewViaApi(
  request: APIRequestContext,
  conversationId: string,
  taskId: string,
) {
  for (const questionId of ["Q1", "Q2", "Q3", "Q4"] as const) {
    const res = await request.post("/api/action", {
      data: {
        conversationId,
        action: {
          type: "answer_interview",
          taskId,
          questionId,
          text: "我喜欢和人打交道，也愿意学习新技能。",
        },
      },
    });
    expect(res.status()).toBe(200);
  }
}

export async function waitForStage(
  request: APIRequestContext,
  conversationId: string,
  stage: string,
  timeoutMs = 15_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await request.get(
      `/api/conversation?conversationId=${conversationId}`,
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as ConversationResponse;
    if (body.state.stage === stage) {
      return body;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for stage ${stage}`);
}

export async function loginViaApi(
  request: APIRequestContext,
  phone = `139${String(Date.now()).slice(-8)}`,
  code = "123456",
) {
  const send = await request.post("/api/auth/send-code", {
    data: { phone },
  });
  expect(send.status()).toBe(200);
  const verify = await request.post("/api/auth/verify", {
    data: { phone, code },
  });
  expect(verify.status()).toBe(200);
}
