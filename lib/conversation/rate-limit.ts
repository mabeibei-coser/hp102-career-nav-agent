import { DomainError } from "@/lib/errors";
import { countUserMessagesSince } from "@/lib/db/repositories/messages";

export function assertChatRate(userId: string): void {
  const since = Date.now() - 10 * 60 * 1000;
  if (countUserMessagesSince(userId, since) >= 30) {
    throw new DomainError("RATE_LIMITED");
  }
}
