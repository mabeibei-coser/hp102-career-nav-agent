import { DomainError } from "@/lib/errors";
import {
  createConversation as createConversationRow,
  getConversation,
  getLatestConversation,
} from "@/lib/db/repositories/conversations";
import { insertMessages } from "@/lib/db/repositories/messages";
import { COPY } from "@/lib/career/copy";
import { ensureActiveTask } from "@/lib/career/service";
import { getConversationView } from "./view";

export function getConversationForUser(userId: string, conversationId: string) {
  const conversation = getConversation(userId, conversationId);
  if (!conversation) {
    throw new DomainError("NOT_FOUND");
  }
  return conversation;
}

export function getOrCreateLatestConversation(userId: string) {
  const latest = getLatestConversation(userId);
  if (latest) return latest;
  return createConversation(userId);
}

export function createConversation(userId: string) {
  const now = new Date();
  const title = `职业导航 · ${now.getMonth() + 1}月${now.getDate()}日`;
  const conversationId = createConversationRow(userId, title);
  const actor = { userId, conversationId };
  ensureActiveTask(actor);

  insertMessages(conversationId, [
    { role: "notice", content: { kind: "text", text: COPY.opening } },
  ]);

  const conversation = getConversation(userId, conversationId);
  if (!conversation) throw new DomainError("INTERNAL");
  const messages = getConversationView(userId, conversationId).messages;
  const state = getConversationView(userId, conversationId).state;
  return { conversation, messages, state };
}
