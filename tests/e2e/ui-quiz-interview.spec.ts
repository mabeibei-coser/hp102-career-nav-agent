import { test, expect } from "@playwright/test";
import { confirmProfileViaUi } from "./ui-helpers";

test.describe("quiz and interview cards UI", () => {
  test("quiz advances and locks answered questions", async ({ page }) => {
    await page.goto("/");
    await confirmProfileViaUi(page);

    await expect(page.getByText("第 1/8 题")).toBeVisible();
    const optionA = page.getByRole("button", { name: /^A\./ }).first();
    await optionA.click();

    await expect(page.getByText("第 2/8 题")).toBeVisible();
    const q1Card = page.locator("text=第 1/8 题").locator("..").locator("..");
    await expect(
      q1Card.getByRole("button", { name: /^A\./ }),
    ).toHaveClass(/border-blue-600/);
    await expect(
      q1Card.getByRole("button", { name: /^A\./ }),
    ).toBeDisabled();
  });

  test("completes quiz and interview with text validation", async ({
    page,
  }) => {
    await page.goto("/");
    await confirmProfileViaUi(page);

    for (let i = 1; i <= 8; i++) {
      await page.getByRole("button", { name: /^A\./, disabled: false }).click();
    }

    await expect(page.getByText("访谈 第 1/4 题")).toBeVisible();
    const submitBtn = page.getByRole("button", { name: "提交回答" });
    await page.getByPlaceholder("说说你的真实想法…").fill("好");
    await expect(submitBtn).toBeDisabled();

    await page
      .getByPlaceholder("说说你的真实想法…")
      .fill("我喜欢和人打交道");
    await submitBtn.click();
    await expect(page.getByText("访谈 第 2/4 题")).toBeVisible();
  });

  test("typed quiz answer via chat composer", async ({ page }) => {
    await page.goto("/");
    await confirmProfileViaUi(page);

    await expect(page.getByText("第 1/8 题")).toBeVisible();
    const input = page.getByPlaceholder("输入消息…");
    await input.fill("选B");
    await input.press("Enter");
    await expect(page.getByText("第 2/8 题")).toBeVisible({ timeout: 15_000 });
  });
});
