import { test, expect } from "@playwright/test";
import {
  answerAllInterviewViaUi,
  answerAllQuizViaUi,
  confirmProfileViaUi,
} from "./ui-helpers";

test.describe("full button flow", () => {
  test("completes profile through report page via cards only", async ({
    page,
  }) => {
    await page.goto("/");
    await confirmProfileViaUi(page);
    await answerAllQuizViaUi(page);
    await answerAllInterviewViaUi(page);

    await expect(
      page.getByRole("button", { name: "生成我的职业导航报告" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "生成我的职业导航报告" }).click();
    await expect(page.getByText("报告生成中")).toBeVisible();

    await expect(page.getByTestId("bipolar-bar")).toHaveCount(4, {
      timeout: 20_000,
    });
    await expect(page.getByText("查看完整报告")).toBeVisible();

    const reportLink = page.getByRole("link", { name: "查看完整报告" });
    await reportLink.click();
    await expect(page).toHaveURL(/\/report\//);
    await expect(page.getByRole("heading", { name: "总评" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "行动计划" })).toBeVisible();
  });
});
