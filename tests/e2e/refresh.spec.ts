import { test, expect } from "@playwright/test";
import { confirmProfileViaUi } from "./ui-helpers";

test.describe("refresh persistence", () => {
  test("restores quiz progress after page refresh", async ({ page }) => {
    await page.goto("/");
    await confirmProfileViaUi(page);

    for (let i = 1; i <= 3; i++) {
      await page.getByRole("button", { name: /^A\./, disabled: false }).click();
    }
    await expect(page.getByText("第 4/8 题")).toBeVisible();

    await page.reload();
    await expect(page.getByText("第 4/8 题")).toBeVisible({ timeout: 15_000 });

    const q1Card = page.locator("text=第 1/8 题").locator("..").locator("..");
    await expect(
      q1Card.getByRole("button", { name: /^A\./ }),
    ).toHaveClass(/border-blue-600/);
  });
});
