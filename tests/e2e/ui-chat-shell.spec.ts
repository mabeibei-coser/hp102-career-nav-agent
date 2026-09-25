import { test, expect } from "@playwright/test";
import { COPY } from "@/lib/career/copy";

test.describe("chat shell UI", () => {
  test("shows opening message and input without a profile card", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(COPY.opening)).toBeVisible();
    await expect(page.getByPlaceholder("输入消息…")).toBeVisible();
    await expect(page.getByRole("button", { name: "确认档案" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(COPY.opening)).toBeVisible();
    await expect(page.getByRole("button", { name: "确认档案" })).toHaveCount(0);
  });

  test("sends message and shows mock reply", async ({ page }) => {
    await page.goto("/");
    const input = page.getByPlaceholder("输入消息…");
    await input.fill("你好");
    await input.press("Enter");
    await expect(page.getByText("正在思考…")).toBeVisible();
    await expect(page.getByText("这是模拟回复。")).toBeVisible();
    await expect(input).toHaveValue("");
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
