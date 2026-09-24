import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db/client";
import { createUser, getUser, touchUser } from "@/lib/db/repositories/users";
import {
  createConversation,
  getConversation,
  getLatestConversation,
  touchConversation,
} from "@/lib/db/repositories/conversations";
import {
  countUserMessagesSince,
  insertMessages,
  listMessages,
} from "@/lib/db/repositories/messages";

describe("db conversation repositories", () => {
  let tempDir: string;
  const originalDbPath = process.env.DB_PATH;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "hp102-db-"));
    process.env.DB_PATH = join(tempDir, "test.db");
    resetDbForTests();
  });

  afterEach(() => {
    resetDbForTests();
    rmSync(tempDir, { recursive: true, force: true });
    if (originalDbPath === undefined) {
      delete process.env.DB_PATH;
    } else {
      process.env.DB_PATH = originalDbPath;
    }
  });

  it("creates and touches users", () => {
    const id = createUser();
    const user = getUser(id);
    expect(user).not.toBeNull();
    expect(user?.id).toBe(id);

    const before = user!.lastSeenAt;
    touchUser(id);
    const updated = getUser(id);
    expect(updated!.lastSeenAt).toBeGreaterThanOrEqual(before);
  });

  it("scopes conversations by user and returns latest by updated_at", () => {
    const userA = createUser();
    const userB = createUser();
    const convA1 = createConversation(userA, "对话一");
    const convA2 = createConversation(userA, "对话二");

    expect(getConversation(userB, convA1)).toBeNull();

    touchConversation(convA1);
    const latest = getLatestConversation(userA);
    expect(latest?.id).toBe(convA1);
    expect(latest?.id).not.toBe(convA2);
  });

  it("assigns sequential message seq and counts user messages", () => {
    const userId = createUser();
    const conversationId = createConversation(userId, "对话");

    const firstBatch = insertMessages(conversationId, [
      { role: "user", content: { kind: "text", text: "a" } },
      { role: "assistant", content: { kind: "text", text: "b" } },
      { role: "user", content: { kind: "text", text: "c" } },
    ]);
    expect(firstBatch.map((m) => m.seq)).toEqual([1, 2, 3]);

    const secondBatch = insertMessages(conversationId, [
      { role: "notice", content: { kind: "notice", text: "d" } },
    ]);
    expect(secondBatch[0].seq).toBe(4);

    const messages = listMessages(conversationId);
    expect(messages.map((m) => m.seq)).toEqual([1, 2, 3, 4]);
    expect(messages[0].content).toEqual({ kind: "text", text: "a" });

    expect(countUserMessagesSince(userId, 0)).toBe(2);
  });
});
