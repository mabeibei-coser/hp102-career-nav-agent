import { NextResponse } from "next/server";
import {
  getConversationForUser,
  getOrCreateLatestConversation,
} from "@/lib/conversation/service";
import { getConversationView } from "@/lib/conversation/view";
import { toErrorResponse } from "@/lib/http";
import { getOrCreateUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const userId = await getOrCreateUser();
    const conversationId = new URL(req.url).searchParams.get("conversationId");

    if (conversationId) {
      const conversation = getConversationForUser(userId, conversationId);
      const view = getConversationView(userId, conversationId);
      return NextResponse.json({
        conversation,
        messages: view.messages,
        state: view.state,
      });
    }

    const result = getOrCreateLatestConversation(userId);
    if ("messages" in result) {
      return NextResponse.json({
        conversation: result.conversation,
        messages: result.messages,
        state: result.state,
      });
    }

    const view = getConversationView(userId, result.id);
    return NextResponse.json({
      conversation: result,
      messages: view.messages,
      state: view.state,
    });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
