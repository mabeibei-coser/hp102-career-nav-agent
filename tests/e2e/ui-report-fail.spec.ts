import { test, expect } from "@playwright/test";
import {
  answerAllInterviewViaUi,
  answerAllQuizViaUi,
  confirmProfileViaUi,
} from "./ui-helpers";

test.describe("report failure UI", () => {
  test("shows failure message and supports retry", async ({ page }) => {
    await page.goto("/");
    await confirmProfileViaUi(page);
    await answerAllQuizViaUi(page);
    await answerAllInterviewViaUi(page);

    await page.getByRole("button", { name: "生成我的职业导航报告" }).click();
    await expect(page.getByText("报告生成中")).toBeVisible();

    await expect(page.getByText("生成服务暂时不可用")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "重试" })).toBeVisible();

    await page.getByRole("button", { name: "重试" }).click();
    await expect(page.getByText("报告生成中")).toBeVisible();
  });
});
