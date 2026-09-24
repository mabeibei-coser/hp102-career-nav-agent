import { test, expect } from "@playwright/test";
import { confirmProfileViaUi } from "./ui-helpers";

test.describe("restart confirm card UI", () => {
  test("cancel restart returns to current quiz question", async ({ page }) => {
    await page.goto("/");
    await confirmProfileViaUi(page);
    await expect(page.getByText("第 1/8 题")).toBeVisible();

    const input = page.getByPlaceholder("输入消息…");
    await input.fill("重新开始");
    await input.press("Enter");
    await expect(
      page.getByRole("button", { name: "确认重新开始" }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "继续当前进度" }).click();
    await expect(page.getByText("第 1/8 题")).toBeVisible();
  });

  test("confirm restart shows new profile card with prefilled identity", async ({
    page,
  }) => {
    await page.goto("/");
    await confirmProfileViaUi(page);
    await expect(page.getByText("第 1/8 题")).toBeVisible();

    const input = page.getByPlaceholder("输入消息…");
    await input.fill("重新开始");
    await input.press("Enter");
    await expect(
      page.getByRole("button", { name: "确认重新开始" }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "确认重新开始" }).click();
    await expect(page.getByRole("button", { name: "确认档案" })).toBeVisible();
    await expect(page.getByLabel("应届毕业生")).toBeChecked();
  });
});
