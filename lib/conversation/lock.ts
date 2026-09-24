import { DomainError } from "@/lib/errors";

const held = new Set<string>();

export async function withConversationLock<T>(
  conversationId: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (held.has(conversationId)) {
    throw new DomainError("BUSY");
  }
  held.add(conversationId);
  try {
    return await fn();
  } finally {
    held.delete(conversationId);
  }
}
