import { NextResponse } from "next/server";
import { getReportByUuid } from "@/lib/db/repositories/reports";
import { DomainError } from "@/lib/errors";
import { toErrorResponse } from "@/lib/http";
import { getOrCreateUser } from "@/lib/session";

export const runtime = "nodejs";

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
