import { expect, type Page } from "@playwright/test";
import path from "path";

export async function fillProfileForm(page: Page) {
  await page.getByLabel("应届毕业生").check();
  await page.locator('input[type="month"]').fill("2003-05");
  await page.locator("select").nth(0).selectOption("bachelor");
  await page.locator("select").nth(1).selectOption("lt1");
}

export async function confirmProfileViaUi(page: Page) {
  await fillProfileForm(page);
  await page.getByRole("button", { name: "确认档案" }).click();
  await expect(page.getByText("档案已保存")).toBeVisible();
}

export async function answerAllQuizViaUi(page: Page) {
  for (let i = 1; i <= 8; i++) {
    await expect(page.getByText(`第 ${i}/8 题`)).toBeVisible();
    await page.getByRole("button", { name: /^A\./, disabled: false }).click();
  }
}

export async function answerAllInterviewViaUi(page: Page) {
  const answer = "我喜欢和人打交道，也愿意学习新技能。";
  for (let i = 1; i <= 4; i++) {
    await expect(page.getByText(`访谈 第 ${i}/4 题`)).toBeVisible();
    await page.getByPlaceholder("说说你的真实想法…").fill(answer);
    await page.getByRole("button", { name: "提交回答" }).click();
  }
}

export async function uploadResumeOnProfileCard(page: Page) {
  const resumePath = path.resolve(
    __dirname,
    "../fixtures/.tmp-resume.docx",
  );
  await page.locator('input[type="file"]').setInputFiles(resumePath);
}
