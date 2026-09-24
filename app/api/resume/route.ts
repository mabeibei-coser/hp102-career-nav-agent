import { NextResponse } from "next/server";
import { attachResume } from "@/lib/career/service";
import { withConversationLock } from "@/lib/conversation/lock";
import { getConversationForUser } from "@/lib/conversation/service";
import { getConversationView } from "@/lib/conversation/view";
import { withTransaction } from "@/lib/db/client";
import { insertMessages } from "@/lib/db/repositories/messages";
import { DomainError } from "@/lib/errors";
import { toErrorResponse } from "@/lib/http";
import { getOrCreateUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const userId = await getOrCreateUser();
    const form = await req.formData();
    const conversationId = form.get("conversationId");
    const file = form.get("file");

    if (typeof conversationId !== "string" || !conversationId) {
      throw new DomainError("INVALID_INPUT");
    }
    if (!(file instanceof File)) {
      throw new DomainError("INVALID_INPUT");
    }

    getConversationForUser(userId, conversationId);
    const actor = { userId, conversationId };
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;
    const mime = file.type || "application/octet-stream";

    const result = await withConversationLock(conversationId, async () => {
      const step = await attachResume(actor, { buffer, fileName, mime });
      const userMsg = {
        role: "user" as const,
        content: {
          kind: "text" as const,
          text: `（上传简历）${fileName}`,
          source: "action" as const,
        },
      };
      const toInsert: Array<{
        role: "user" | "notice" | "card";
        content: unknown;
      }> = [userMsg];
      for (const notice of step.notices) {
        toInsert.push({
          role: "notice",
          content: { kind: "text", text: notice },
        });
      }
      for (const card of step.cards) {
        toInsert.push({
          role: "card",
          content: { kind: "card", card },
        });
      }
      const inserted = withTransaction(() =>
        insertMessages(conversationId, toInsert),
      );
      const view = getConversationView(userId, conversationId);
      return {
        messages: inserted.map((m) => ({
          id: m.id,
          seq: m.seq,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
        state: view.state,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
