import { test, expect } from "@playwright/test";
import { COPY } from "@/lib/career/copy";
import {
  answerAllInterviewViaUi,
  answerAllQuizViaUi,
  confirmProfileViaUi,
  generateReportViaUi,
  uploadResumeOnProfileCard,
} from "./ui-helpers";

test.describe("report page UI", () => {
  test("full report page with resume shows all sections", async ({ page }) => {
    await page.goto("/");
    await uploadResumeOnProfileCard(page);
    await confirmProfileViaUi(page);
    await answerAllQuizViaUi(page);
    await answerAllInterviewViaUi(page);
    await generateReportViaUi(page);

    await page.getByRole("link", { name: "查看完整报告" }).click();
    await expect(page).toHaveURL(/\/report\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: "总评" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "优势发现" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "职业定位" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "简历快诊" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "行动计划" })).toBeVisible();
    await expect(page.getByText(COPY.disclaimer)).toBeVisible();
  });

  test("report page without resume hides resume section", async ({ page }) => {
    await page.goto("/");
    await confirmProfileViaUi(page);
    await answerAllQuizViaUi(page);
    await answerAllInterviewViaUi(page);
    await generateReportViaUi(page);
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
    await generateReportViaUi(page1);
    const reportLink = page1.getByRole("link", { name: "查看完整报告" });
    const href = await reportLink.getAttribute("href");
    await ctx1.close();

    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto(href!);
    await expect(page2.getByText("没有找到对应内容")).toBeVisible();
    await ctx2.close();
  });

  test("overview section has 4 bipolar bars with pole labels", async ({
    page,
  }) => {
    await page.goto("/");
    await uploadResumeOnProfileCard(page);
    await confirmProfileViaUi(page);
    await answerAllQuizViaUi(page);
    await answerAllInterviewViaUi(page);
    await generateReportViaUi(page);
    await page.getByRole("link", { name: "查看完整报告" }).click();

    const bars = page.locator('[data-testid="bipolar-bar"]');
    await expect(bars).toHaveCount(4);

    await expect(page.getByText("内敛沉稳")).toBeVisible();
    await expect(page.getByText("主动外向")).toBeVisible();
    await expect(page.getByText("按部就班")).toBeVisible();
    await expect(page.getByText("灵活应变")).toBeVisible();
    await expect(page.getByText("稳定务实")).toBeVisible();
    await expect(page.getByText("探索成长")).toBeVisible();
    await expect(page.getByText("专注深耕")).toBeVisible();
    await expect(page.getByText("多元适应")).toBeVisible();
  });

  test("strength section shows 6 ability names", async ({ page }) => {
    await page.goto("/");
    await confirmProfileViaUi(page);
    await answerAllQuizViaUi(page);
    await answerAllInterviewViaUi(page);
    await generateReportViaUi(page);
    await page.getByRole("link", { name: "查看完整报告" }).click();

    await expect(page.getByText("沟通表达", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("协作意识", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("执行落地", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("学习能力", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("信息处理", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("压力适应", { exact: false }).first()).toBeVisible();
  });

  test("positioning section has competency radar and position names", async ({
    page,
  }) => {
    await page.goto("/");
    await uploadResumeOnProfileCard(page);
    await confirmProfileViaUi(page);
    await answerAllQuizViaUi(page);
    await answerAllInterviewViaUi(page);
    await generateReportViaUi(page);
    await page.getByRole("link", { name: "查看完整报告" }).click();

    const radar = page.locator('[data-testid="competency-radar"]');
    await expect(radar.first()).toBeVisible();

    await expect(page.getByRole("heading", { name: "客户服务专员（金融机构）" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "行政人事助理" })).toBeVisible();
  });

  test("resume diagnosis shows priority labels and advice has 3 items", async ({
    page,
  }) => {
    await page.goto("/");
    await uploadResumeOnProfileCard(page);
    await confirmProfileViaUi(page);
    await answerAllQuizViaUi(page);
    await answerAllInterviewViaUi(page);
    await generateReportViaUi(page);
    await page.getByRole("link", { name: "查看完整报告" }).click();

    await expect(page.getByText("建议优先补充")).toBeVisible();

    const adviceSection = page.locator("#advice");
    const adviceItems = adviceSection.locator(
      "span.inline-flex.items-center.justify-center.rounded-lg",
    );
    await expect(adviceItems).toHaveCount(3);
  });
});
