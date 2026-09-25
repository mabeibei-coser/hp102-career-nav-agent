import puppeteer from "puppeteer";
import { signPdfToken } from "../pdf-token";

function mockPdfBuffer(): Buffer {
  const pad = "A".repeat(12_000);
  return Buffer.from(
    `%PDF-1.4
1 0 obj<<>>endobj
2 0 obj<< /Length ${pad.length} >>stream
${pad}
endstream
endobj
trailer<<>>
%%EOF`,
    "utf8",
  );
}

export async function renderReportPdf(
  reportUuid: string,
  port: number,
  basePath: string,
): Promise<Buffer> {
  if (process.env.E2E_MOCK_MODE === "true") {
    return mockPdfBuffer();
  }

  const token = signPdfToken(reportUuid);
  const url = `http://127.0.0.1:${port}${basePath}/report/${reportUuid}?pdf=1&pdfToken=${encodeURIComponent(token)}`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0", timeout: 120_000 });
    await page.waitForSelector("[data-pdf-section]", { timeout: 60_000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "15mm", bottom: "15mm", left: "10mm", right: "10mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
