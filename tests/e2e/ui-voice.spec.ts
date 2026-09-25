import { test, expect } from "@playwright/test";
import {
  confirmProfileViaUi,
  answerAllQuizViaUi,
} from "./ui-helpers";

test.describe("interview voice UI", () => {
  test("record → transcript → submit; speak hits tts", async ({ page }) => {
    await page.goto("/");
    await confirmProfileViaUi(page);
    await answerAllQuizViaUi(page);

    await expect(page.getByText(/访谈 第 1/)).toBeVisible({ timeout: 15_000 });

    const ttsPromise = page.waitForResponse(
      (r) => r.url().includes("/api/voice/tts") && r.status() === 200,
    );
    await page.getByRole("button", { name: "朗读" }).click();
    await ttsPromise;

    await page.getByRole("button", { name: "录音" }).click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /停止/ }).click();
    await expect(
      page.getByPlaceholder("说说你的真实想法…"),
    ).toHaveValue("（模拟转写）我喜欢和人打交道", { timeout: 10_000 });
    await page.getByRole("button", { name: "提交回答" }).click();
    await expect(page.getByText(/访谈 第 2/)).toBeVisible({ timeout: 15_000 });
  });
});
