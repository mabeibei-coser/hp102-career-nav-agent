import { test, expect } from "@playwright/test";

test.describe("chat API", () => {
  test("sends greeting and returns mock reply", async ({ request }) => {
    const conv = await request.get("/api/conversation");
    const { conversation } = await conv.json();

    const res = await request.post("/api/chat", {
      data: { conversationId: conversation.id, text: "你好" },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/json");
    expect(res.headers()["content-type"]).not.toContain("text/event-stream");

    const body = await res.json();
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].content.text).toBe("你好");
    expect(body.messages[1].content.text).toBe("这是模拟回复。");
    expect(body.state.stage).toBe("profile");
  });

  test("profile text updates profile_form card draft", async ({ request }) => {
    const conv = await request.get("/api/conversation");
    const { conversation } = await conv.json();

    const res = await request.post("/api/chat", {
      data: {
        conversationId: conversation.id,
        text: "档案：identity=recent_grad；education=bachelor",
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const cardMsg = body.messages.find(
      (m: { content: { card?: { type: string } } }) =>
        m.content.card?.type === "profile_form",
    );
    expect(cardMsg).toBeTruthy();
    expect(cardMsg.content.card.draft.education).toBe("bachelor");
  });

  test("rejects empty and overlong text", async ({ request }) => {
    const conv = await request.get("/api/conversation");
    const { conversation } = await conv.json();

    const empty = await request.post("/api/chat", {
      data: { conversationId: conversation.id, text: "" },
    });
    expect(empty.status()).toBe(400);
    expect((await empty.json()).error.code).toBe("INVALID_INPUT");

    const long = await request.post("/api/chat", {
      data: { conversationId: conversation.id, text: "x".repeat(1001) },
    });
    expect(long.status()).toBe(400);
    expect((await long.json()).error.code).toBe("INVALID_INPUT");
  });
});
