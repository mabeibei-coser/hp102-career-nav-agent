import { NextResponse } from "next/server";
import { getReportByUuid } from "@/lib/db/repositories/reports";
import { DomainError } from "@/lib/errors";
import { toErrorResponse } from "@/lib/http";
import { getOrCreateUser } from "@/lib/session";
import { verifyPdfToken } from "@/lib/pdf-token";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ reportUuid: string }> },
) {
  try {
    const { reportUuid } = await params;
    const url = new URL(req.url);
    const pdfToken = url.searchParams.get("pdfToken");

    let row;
    if (pdfToken && verifyPdfToken(reportUuid, pdfToken)) {
      row = getReportByUuid("", reportUuid, true);
    } else {
      const userId = await getOrCreateUser();
      row = getReportByUuid(userId, reportUuid);
    }

    if (!row) {
      throw new DomainError("NOT_FOUND");
    }
    return NextResponse.json({
      reportUuid: row.uuid,
      createdAt: row.createdAt,
      report: JSON.parse(row.reportJson),
    });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
