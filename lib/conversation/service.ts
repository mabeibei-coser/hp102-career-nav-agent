import { DomainError } from "@/lib/errors";
import {
  createConversation as createConversationRow,
  getConversation,
  getLatestConversation,
} from "@/lib/db/repositories/conversations";
import { insertMessages } from "@/lib/db/repositories/messages";
import { getProfile } from "@/lib/db/repositories/profiles";
import { profileFormCard } from "@/lib/career/cards";
import { COPY } from "@/lib/career/copy";
import { ensureActiveTask } from "@/lib/career/service";
import type { ProfileDraft } from "@/lib/career/profile";
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

  const profile = getProfile(userId);
  const draft: ProfileDraft = profile
    ? {
        identity: profile.identity,
        birthDate: profile.birthDate,
        education: profile.education,
        workYears: profile.workYears,
        targetPosition: profile.targetPosition,
        resumeFileId: profile.resumeFileId,
      }
    : {};

  const task = ensureActiveTask(actor);
  insertMessages(conversationId, [
    { role: "notice", content: { kind: "text", text: COPY.opening } },
    {
      role: "card",
      content: {
        kind: "card",
        card: profileFormCard(task.id, draft, null),
      },
    },
  ]);

  const conversation = getConversation(userId, conversationId);
  if (!conversation) throw new DomainError("INTERNAL");
  const messages = getConversationView(userId, conversationId).messages;
  const state = getConversationView(userId, conversationId).state;
  return { conversation, messages, state };
}
