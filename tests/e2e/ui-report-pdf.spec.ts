import { test, expect } from "@playwright/test";
import {
  answerAllInterviewViaUi,
  answerAllQuizViaUi,
  confirmProfileViaUi,
  generateReportViaUi,
  uploadResumeOnProfileCard,
} from "./ui-helpers";

test.describe("report PDF", () => {
  test("download PDF from report page; unauthenticated pdf route 404", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await uploadResumeOnProfileCard(page);
    await confirmProfileViaUi(page);
    await answerAllQuizViaUi(page);
    await answerAllInterviewViaUi(page);
    await generateReportViaUi(page);

    await page.getByRole("link", { name: "查看完整报告" }).click();
    await expect(page.getByRole("heading", { name: "总评" })).toBeVisible();

    const [pdfPage] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("button", { name: "下载 PDF 报告" }).click(),
    ]);

    const pdfRes = await pdfPage.waitForEvent("response", {
      predicate: (r) => r.url().includes("/pdf"),
      timeout: 30_000,
    });
    expect(pdfRes.headers()["content-type"]).toBe("application/pdf");
    const body = await pdfRes.body();
    expect(body.length).toBeGreaterThan(10_000);
    await pdfPage.close();

    const res2 = await page.request.get(
      "/api/report/00000000-0000-0000-0000-000000000000/pdf",
    );
    expect(res2.status()).toBe(404);
  });
});
