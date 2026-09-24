import { after, NextResponse } from "next/server";
import { z } from "zod";
import { runReportJob } from "@/lib/career/report/jobs";
import { handleAction } from "@/lib/conversation/actions";
import { getConversationForUser } from "@/lib/conversation/service";
import { DomainError } from "@/lib/errors";
import { toErrorResponse } from "@/lib/http";
import { getOrCreateUser } from "@/lib/session";

export const runtime = "nodejs";

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  action: z.unknown(),
});

function clientMeta(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
  const userAgent = req.headers.get("user-agent") || undefined;
  return { ip, userAgent };
}

export async function POST(req: Request) {
  try {
    const userId = await getOrCreateUser();
    const body = bodySchema.parse(await req.json());
    getConversationForUser(userId, body.conversationId);

    const result = await handleAction(
      { userId, conversationId: body.conversationId },
      body.action,
      clientMeta(req),
    );

    if (result.jobId) {
      const jobId = result.jobId;
      after(() => runReportJob(jobId));
    }

    return NextResponse.json({
      messages: result.messages,
      state: result.state,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const { status, body } = toErrorResponse(
        new DomainError("INVALID_INPUT"),
      );
      return NextResponse.json(body, { status });
    }
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
