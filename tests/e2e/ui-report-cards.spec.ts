import { test, expect } from "@playwright/test";
import { COPY } from "@/lib/career/copy";
import {
  answerAllInterviewViaUi,
  answerAllQuizViaUi,
  confirmProfileViaUi,
  generateReportViaUi,
} from "./ui-helpers";

test.describe("report cards UI", () => {
  test("generates report and shows summary card", async ({ page }) => {
    await page.goto("/");
    await confirmProfileViaUi(page);
    await answerAllQuizViaUi(page);
    await answerAllInterviewViaUi(page);

    await expect(
      page.getByRole("button", { name: "生成我的职业导航报告" }),
    ).toBeVisible();
    await generateReportViaUi(page);

    await expect(page.getByTestId("bipolar-bar")).toHaveCount(4);
    await expect(
      page.getByRole("link", { name: "查看完整报告" }),
    ).toBeVisible();
    await expect(page.getByText(COPY.disclaimer)).toBeVisible();
  });

  test("chat still works after report summary", async ({ page }) => {
    await page.goto("/");
    await confirmProfileViaUi(page);
    await answerAllQuizViaUi(page);
    await answerAllInterviewViaUi(page);
    await generateReportViaUi(page);

    const input = page.getByPlaceholder("输入消息…");
    await input.fill("你好");
    await input.press("Enter");
    await expect(page.getByText("这是模拟回复。")).toBeVisible();
  });
});
