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
    await expect(page.getByText(`访谈 第 ${i}/4 题`)).toBeVisible({
      timeout: 20_000,
    });
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

export async function loginViaUi(
  page: Page,
  phone = `138${String(Date.now()).slice(-8)}`,
  code = "123456",
) {
  await page.getByPlaceholder("请输入手机号").fill(phone);
  await page.getByRole("button", { name: "获取验证码" }).click();
  await expect(page.getByPlaceholder("请输入 6 位验证码")).toBeVisible({
    timeout: 10_000,
  });
  await page.getByPlaceholder("请输入 6 位验证码").fill(code);
  await page.getByRole("button", { name: "验证并生成报告" }).click();
}

/** Click generate; complete login if the login card appears; wait for summary. */
export async function generateReportViaUi(page: Page) {
  await page.getByRole("button", { name: "生成我的职业导航报告" }).click();
  const loginField = page.getByPlaceholder("请输入手机号");
  try {
    await expect(loginField).toBeVisible({ timeout: 3_000 });
    await loginViaUi(page);
  } catch {
    // already logged in — continue
  }
  await expect(page.getByText("报告摘要")).toBeVisible({ timeout: 30_000 });
}
