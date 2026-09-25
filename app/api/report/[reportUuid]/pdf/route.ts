import { NextResponse } from "next/server";
import { getReportByUuid } from "@/lib/db/repositories/reports";
import { DomainError } from "@/lib/errors";
import { toErrorResponse } from "@/lib/http";
import { getOrCreateUser } from "@/lib/session";
import { renderReportPdf } from "@/lib/pdf/render";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ reportUuid: string }> },
) {
  try {
    const userId = await getOrCreateUser();
    const { reportUuid } = await params;
    const row = getReportByUuid(userId, reportUuid);
    if (!row) {
      throw new DomainError("NOT_FOUND");
    }

    const port = parseInt(process.env.PORT ?? "3000", 10);
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const pdf = await renderReportPdf(reportUuid, port, basePath);

    const filename = "职业导航报告.pdf";
    const encoded = encodeURIComponent(filename);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="career-report.pdf"; filename*=UTF-8''${encoded}`,
        "Content-Length": String(pdf.length),
      },
    });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
