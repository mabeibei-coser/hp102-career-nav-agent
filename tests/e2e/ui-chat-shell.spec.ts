import { test, expect } from "@playwright/test";
import { COPY } from "@/lib/career/copy";

test.describe("chat shell UI", () => {
  test("shows opening message and input without a profile card", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("就业服务智能体");
    await expect(page.getByRole("heading", { name: "就业服务智能体" })).toBeVisible();
    await expect(page.getByText(COPY.opening)).toBeVisible();
    await expect(page.getByPlaceholder("输入消息…")).toBeVisible();
    await expect(page.getByRole("button", { name: "确认档案" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(COPY.opening)).toBeVisible();
    await expect(page.getByRole("button", { name: "确认档案" })).toHaveCount(0);
  });

  test("sends message and shows mock reply", async ({ page }) => {
    await page.goto("/");
    const conversation = await page.evaluate(async () => {
      const response = await fetch("/api/conversation");
      return response.json();
    });
    await page.route("**/api/chat", async (route) => {
      const body = route.request().postDataJSON() as { text: string };
      const seq = conversation.messages.at(-1)?.seq ?? 0;
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          messages: [
            {
              id: "mock-user-message",
              seq: seq + 1,
              role: "user",
              content: { kind: "text", text: body.text, source: "chat" },
              createdAt: Date.now(),
            },
            {
              id: "mock-assistant-message",
              seq: seq + 2,
              role: "assistant",
              content: { kind: "text", text: "这是模拟回复。" },
              createdAt: Date.now(),
            },
          ],
          state: conversation.state,
        }),
      });
    });
    const input = page.getByPlaceholder("输入消息…");
    await input.fill("你好");
    const chatResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/chat") &&
        response.request().method() === "POST",
    );
    await input.press("Enter");
    await expect(page.getByText("你好", { exact: true })).toBeVisible();
    await expect(input).toHaveValue("");
    await expect(page.getByText("正在思考…")).toBeVisible();
    expect((await chatResponse).status()).toBe(200);
    await expect(page.getByText("这是模拟回复。")).toBeVisible();
  });

  test("persists messages on refresh and supports new conversation", async ({
    page,
  }) => {
    await page.goto("/");
    const input = page.getByPlaceholder("输入消息…");
    await input.fill("你好");
    await input.press("Enter");
    await expect(page.getByText("这是模拟回复。")).toBeVisible();

    await page.reload();
    await expect(page.getByText("这是模拟回复。")).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "新对话" }).click();
    await expect(page.getByText(COPY.opening)).toBeVisible();
    await expect(page.getByText("这是模拟回复。")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "确认档案" })).toHaveCount(0);
  });

  test("keeps multi-turn questions card-free until an explicit start", async ({ page }) => {
    await page.goto("/");
    const input = page.getByPlaceholder("输入消息…");
    const questions = ["我是本科毕业，有三年经验，想换工作", "测评是什么", "继续"];
    for (const [i, question] of questions.entries()) {
      await input.fill(question);
      await input.press("Enter");
      await expect(page.getByText("这是模拟回复。", { exact: true })).toHaveCount(i + 1);
      await expect(page.getByRole("button", { name: "确认档案" })).toHaveCount(0);
    }
    await page.reload();
    await expect(page.getByText("这是模拟回复。", { exact: true })).toHaveCount(3);
    await expect(page.getByRole("button", { name: "确认档案" })).toHaveCount(0);
    await input.fill("开始测评");
    await input.press("Enter");
    await expect(page.getByRole("button", { name: "确认档案" })).toBeVisible();
    await page.getByLabel("应届毕业生").check();
    await page.locator('input[type="month"]').fill("2003-05");
    await page.reload();
    await expect(page.getByRole("button", { name: "确认档案" })).toBeVisible();
  });
});
