import { test, expect } from "@playwright/test";
import { COPY } from "@/lib/career/copy";

test.describe("conversation API", () => {
  test("GET creates session and returns opening conversation", async ({
    request,
  }) => {
    const res = await request.get("/api/conversation");
    expect(res.status()).toBe(200);

    const setCookie = res.headers()["set-cookie"] ?? "";
    expect(setCookie).toContain("hp102_session");

    const body = await res.json();
    expect(body.messages[0].content.text).toBe(COPY.opening);
    expect(body.messages).toHaveLength(1);
    expect(body.state.activeCardMessageId).toBeNull();
    expect(body.state.fallbackCard).toBeNull();
    expect(body.state.stage).toBe("profile");
  });

  test("GET returns same conversation; POST /new creates a different one", async ({
    request,
  }) => {
    const first = await request.get("/api/conversation");
    expect(first.status()).toBe(200);
    const firstBody = await first.json();
    const firstId = firstBody.conversation.id;

    const second = await request.get("/api/conversation");
    expect(second.status()).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.conversation.id).toBe(firstId);

    const newRes = await request.post("/api/conversation/new", { data: {} });
    expect(newRes.status()).toBe(200);
    const newBody = await newRes.json();
    expect(newBody.conversation.id).not.toBe(firstId);
    expect(newBody.messages).toHaveLength(1);
    expect(newBody.state.fallbackCard).toBeNull();
  });

  test("foreign conversationId returns NOT_FOUND", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const reqA = ctxA.request;
    const a = await reqA.get("/api/conversation");
    const aBody = await a.json();
    const foreignId = aBody.conversation.id;
    await ctxA.close();

    const ctxB = await browser.newContext();
    const res = await ctxB.request.get(
      `/api/conversation?conversationId=${foreignId}`,
    );
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
    await ctxB.close();
  });
});
