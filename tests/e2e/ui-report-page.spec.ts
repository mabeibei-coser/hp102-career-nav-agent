import { test, expect } from "@playwright/test";
import { COPY } from "@/lib/career/copy";
import {
  answerAllInterviewViaUi,
  answerAllQuizViaUi,
  confirmProfileViaUi,
  uploadResumeOnProfileCard,
} from "./ui-helpers";

test.describe("report page UI", () => {
  test("full report page with resume shows all sections", async ({ page }) => {
    await page.goto("/");
    await uploadResumeOnProfileCard(page);
    await confirmProfileViaUi(page);
    await answerAllQuizViaUi(page);
    await answerAllInterviewViaUi(page);

    await page.getByRole("button", { name: "生成我的职业导航报告" }).click();
    await expect(page.getByText("报告摘要")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("link", { name: "查看完整报告" }).click();
    await expect(page).toHaveURL(/\/report\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: "总评" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "优势发现" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "职业定位" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "简历快诊" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "行动计划" }),
    ).toBeVisible();
    await expect(page.getByText(COPY.disclaimer)).toBeVisible();
  });

  test("report page without resume hides resume section", async ({ page }) => {
    await page.goto("/");
    await confirmProfileViaUi(page);
    await answerAllQuizViaUi(page);
    await answerAllInterviewViaUi(page);

    await page.getByRole("button", { name: "生成我的职业导航报告" }).click();
    await expect(page.getByText("报告摘要")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("link", { name: "查看完整报告" }).click();

    await expect(
      page.getByRole("heading", { name: "简历快诊" }),
    ).not.toBeVisible();
  });

  test("report page returns not found for different user", async ({
    browser,
  }) => {
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await page1.goto("/");
    await confirmProfileViaUi(page1);
    await answerAllQuizViaUi(page1);
    await answerAllInterviewViaUi(page1);
    await page1.getByRole("button", { name: "生成我的职业导航报告" }).click();
    await expect(page1.getByText("报告摘要")).toBeVisible({ timeout: 15_000 });
    const reportLink = page1.getByRole("link", { name: "查看完整报告" });
    const href = await reportLink.getAttribute("href");
    await ctx1.close();

    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto(href!);
    await expect(page2.getByText("没有找到对应内容")).toBeVisible();
    await ctx2.close();
  });
});
