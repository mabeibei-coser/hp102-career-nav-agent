"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage, ConversationState } from "@/lib/conversation/view";
import {
  FallbackCardItem,
  MessageItem,
  type ChatAction,
} from "./message-item";
import { ThinkingIndicator } from "./thinking-indicator";

type MessageListProps = {
  messages: ChatMessage[];
  state: ConversationState;
  thinking?: boolean;
  disabled?: boolean;
  loadingAction?: boolean;
  error?: string | null;
  onAction: (action: ChatAction) => void;
  onUploadResume: (file: File) => void;
};

function visibleMessages(
  messages: ChatMessage[],
  activeTaskId: string,
): ChatMessage[] {
  const latestProfileByTask = new Map<string, string>();
  for (const m of messages) {
    if (
      m.role === "card" &&
      m.content.kind === "card" &&
      m.content.card.type === "profile_form"
    ) {
      latestProfileByTask.set(m.content.card.taskId, m.id);
    }
  }
  return messages.filter((m) => {
    if (
      m.role === "card" &&
      m.content.kind === "card" &&
      m.content.card.type === "profile_form"
    ) {
      if (m.content.card.taskId !== activeTaskId) return false;
      return latestProfileByTask.get(m.content.card.taskId) === m.id;
    }
    return true;
  });
}

export function MessageList({
  messages,
  state,
  thinking,
  disabled,
  loadingAction,
  error,
  onAction,
  onUploadResume,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const displayMessages = visibleMessages(messages, state.activeTaskId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages.length, thinking, state.fallbackCard]);

  const showFallback =
    state.fallbackCard &&
    !messages.some(
      (m) =>
        m.id === state.activeCardMessageId ||
        (m.role === "card" &&
          m.content.kind === "card" &&
          m.content.card.type === state.fallbackCard?.type &&
          JSON.stringify(m.content.card) === JSON.stringify(state.fallbackCard)),
    );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[720px] py-4">
        {displayMessages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            messages={displayMessages}
            state={state}
            disabled={disabled}
            loadingAction={loadingAction}
            onAction={onAction}
            onUploadResume={onUploadResume}
            fallbackCard={state.fallbackCard}
          />
        ))}
        {showFallback && state.fallbackCard && (
          <FallbackCardItem
            card={state.fallbackCard}
            state={state}
            disabled={disabled}
            loadingAction={loadingAction}
            onAction={onAction}
            onUploadResume={onUploadResume}
          />
        )}
        {thinking && <ThinkingIndicator />}
        {error && (
          <div className="mx-4 my-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
