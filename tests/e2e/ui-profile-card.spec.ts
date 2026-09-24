import { test, expect } from "@playwright/test";
import {
  confirmProfileViaUi,
  fillProfileForm,
  uploadResumeOnProfileCard,
} from "./ui-helpers";

test.describe("profile form card UI", () => {
  test("confirm button disabled until required fields filled", async ({
    page,
  }) => {
    await page.goto("/");
    const confirmBtn = page.getByRole("button", { name: "确认档案" });
    await expect(confirmBtn).toBeDisabled();
    await expect(page.getByText(/请填写/)).toBeVisible();

    await fillProfileForm(page);
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();
    await expect(page.getByText("档案已保存")).toBeVisible();
  });

  test("resume upload prefills education and shows privacy tip", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByText("上传前请遮盖身份证号、家庭住址等敏感信息"),
    ).toBeVisible();

    await uploadResumeOnProfileCard(page);
    await expect(page.getByText(".tmp-resume.docx")).toBeVisible();
    await expect(page.locator("select").nth(0)).toHaveValue("bachelor");
  });

  test("confirmed profile card becomes read-only", async ({ page }) => {
    await page.goto("/");
    await confirmProfileViaUi(page);
    await expect(page.getByText("第 1/8 题")).toBeVisible();

    const monthInput = page.locator('input[type="month"]');
    await expect(monthInput).toBeDisabled();
  });
});
