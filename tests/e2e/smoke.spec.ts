import { test, expect } from "@playwright/test";
import { COPY } from "@/lib/career/copy";

test("GET / returns 200", async ({ request }) => {
  const res = await request.get("/");
  expect(res.status()).toBe(200);
});

test("homepage shows opening message", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(COPY.opening)).toBeVisible();
});
