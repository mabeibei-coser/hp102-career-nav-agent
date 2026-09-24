import { NextResponse } from "next/server";
import { createConversation } from "@/lib/conversation/service";
import { toErrorResponse } from "@/lib/http";
import { getOrCreateUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST() {
  try {
    const userId = await getOrCreateUser();
    const result = createConversation(userId);
    return NextResponse.json({
      conversation: result.conversation,
      messages: result.messages,
      state: result.state,
    });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
