import { test, expect } from "@playwright/test";
import { generateReportViaUi } from "./ui-helpers";

test.describe("full typed flow", () => {
  test("completes flow via chat text and confirm button", async ({ page }) => {
    await page.goto("/");

    const input = page.getByPlaceholder("输入消息…");
    await input.fill(
      "档案：identity=recent_grad；birthDate=2003-05；education=bachelor；workYears=lt1",
    );
    await input.press("Enter");
    await expect(page.getByRole("button", { name: "确认档案" })).toBeEnabled({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "确认档案" }).click();
    await expect(page.getByText("档案已保存")).toBeVisible();

    for (let i = 0; i < 8; i++) {
      await input.fill("选A");
      await input.press("Enter");
      await page.waitForTimeout(500);
    }
    await expect(page.getByText("访谈 第 1/4 题")).toBeVisible({
      timeout: 15_000,
    });

    const interviewAnswer = "我喜欢和人打交道，也愿意学习新技能。";
    for (let i = 1; i <= 4; i++) {
      await expect(page.getByText(`访谈 第 ${i}/4 题`)).toBeVisible({
        timeout: 20_000,
      });
      await input.fill(`回答：${interviewAnswer}`);
      await input.press("Enter");
      if (i < 4) {
        await expect(page.getByText(`访谈 第 ${i + 1}/4 题`)).toBeVisible({
          timeout: 20_000,
        });
      }
    }

    await expect(
      page.getByRole("button", { name: "生成我的职业导航报告" }),
    ).toBeVisible({ timeout: 30_000 });
    await generateReportViaUi(page);
    await expect(page.getByTestId("bipolar-bar")).toHaveCount(4, {
      timeout: 20_000,
    });
  });
});
