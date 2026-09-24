import { test, expect } from "@playwright/test";
import { COPY } from "@/lib/career/copy";

test.describe("chat shell UI", () => {
  test("shows opening message, input, and profile card", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(COPY.opening)).toBeVisible();
    await expect(page.getByPlaceholder("输入消息…")).toBeVisible();
    await expect(page.getByRole("button", { name: "确认档案" })).toBeVisible();
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
    await expect(page.getByRole("button", { name: "确认档案" })).toBeVisible();
  });
});
