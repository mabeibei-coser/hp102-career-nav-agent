import { NextResponse } from "next/server";
import { z } from "zod";
import { runChatTurn } from "@/lib/agent/loop";
import { getConversationForUser } from "@/lib/conversation/service";
import { DomainError } from "@/lib/errors";
import { toErrorResponse } from "@/lib/http";
import { getOrCreateUser } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  text: z.string(),
});

export async function POST(req: Request) {
  try {
    const userId = await getOrCreateUser();
    const body = bodySchema.parse(await req.json());
    getConversationForUser(userId, body.conversationId);

    const result = await runChatTurn({
      userId,
      conversationId: body.conversationId,
      text: body.text,
    });

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
