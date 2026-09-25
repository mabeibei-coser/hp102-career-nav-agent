import { test, expect } from "@playwright/test";
import {
  answerAllInterviewViaUi,
  answerAllQuizViaUi,
  confirmProfileViaUi,
  loginViaUi,
} from "./ui-helpers";

test.describe("login before report", () => {
  test("shows login card when not logged in, then generates report", async ({
    page,
  }) => {
    await page.goto("/");
    await confirmProfileViaUi(page);
    await answerAllQuizViaUi(page);
    await answerAllInterviewViaUi(page);

    await page.getByRole("button", { name: "生成我的职业导航报告" }).click();
    await expect(page.getByText("手机号验证")).toBeVisible();
    await loginViaUi(page);
    await expect(page.getByText("报告摘要")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("second generate in same session skips login card", async ({ page }) => {
    await page.goto("/");
    await confirmProfileViaUi(page);
    await answerAllQuizViaUi(page);
    await answerAllInterviewViaUi(page);
    await page.getByRole("button", { name: "生成我的职业导航报告" }).click();
    await loginViaUi(page);
    await expect(page.getByText("报告摘要")).toBeVisible({ timeout: 30_000 });

    // After report_ready, generate again is not available — assert phone remains by checking no login on CTA path:
    // Restart via chat keeps same session user (phone set).
    const input = page.getByPlaceholder("输入消息…");
    await input.fill("重新开始");
    await input.press("Enter");
    await page.getByRole("button", { name: "确认重新开始" }).click();
    await confirmProfileViaUi(page);
    await answerAllQuizViaUi(page);
    await answerAllInterviewViaUi(page);
    await page.getByRole("button", { name: "生成我的职业导航报告" }).click();
    await expect(page.getByText("手机号验证")).toHaveCount(0);
    await expect(page.getByText("报告摘要")).toBeVisible({ timeout: 30_000 });
  });
});
