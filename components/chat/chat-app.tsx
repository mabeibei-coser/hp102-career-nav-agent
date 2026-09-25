"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api-base";
import type { ChatMessage, ConversationState } from "@/lib/conversation/view";
import { Composer } from "./composer";
import { MessageList } from "./message-list";
import type { ChatAction } from "./message-item";

const STORAGE_KEY = "hp102.conversationId";

type ConversationData = {
  conversation: { id: string; title: string };
  messages: ChatMessage[];
  state: ConversationState;
};

type ApiError = { error?: { message?: string } };

function appendMessages(
  existing: ChatMessage[],
  newMsgs: ChatMessage[],
): ChatMessage[] {
  const ids = new Set(existing.map((m) => m.id));
  const toAdd = newMsgs.filter((m) => !ids.has(m.id));
  return [...existing, ...toAdd];
}

export function ChatApp() {
  const [data, setData] = useState<ConversationData | null>(null);
  const [thinking, setThinking] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerText, setComposerText] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const disabled = thinking || loadingAction;

  const applyConversation = useCallback((next: ConversationData) => {
    setData(next);
    localStorage.setItem(STORAGE_KEY, next.conversation.id);
  }, []);

  const loadConversation = useCallback(
    async (conversationId?: string | null) => {
      const stored = conversationId ?? localStorage.getItem(STORAGE_KEY);
      const url = stored
        ? apiUrl(`/api/conversation?conversationId=${stored}`)
        : apiUrl("/api/conversation");
      const res = await fetch(url);
      if (!res.ok) {
        if (stored && res.status === 404) {
          localStorage.removeItem(STORAGE_KEY);
          const retryRes = await fetch(apiUrl("/api/conversation"));
          if (!retryRes.ok) {
            const body = (await retryRes.json()) as ApiError;
            throw new Error(body.error?.message ?? "加载失败");
          }
          const json = (await retryRes.json()) as ConversationData;
          applyConversation(json);
          return json;
        }
        const body = (await res.json()) as ApiError;
        throw new Error(body.error?.message ?? "加载失败");
      }
      const json = (await res.json()) as ConversationData;
      applyConversation(json);
      return json;
    },
    [applyConversation],
  );

  useEffect(() => {
    let cancelled = false;
    const stored = localStorage.getItem(STORAGE_KEY);
    const url = stored
      ? apiUrl(`/api/conversation?conversationId=${stored}`)
      : apiUrl("/api/conversation");

    void (async () => {
      try {
        let res = await fetch(url);
        if (!res.ok && stored && res.status === 404) {
          localStorage.removeItem(STORAGE_KEY);
          res = await fetch(apiUrl("/api/conversation"));
        }
        if (!res.ok) {
          const body = (await res.json()) as ApiError;
          throw new Error(body.error?.message ?? "加载失败");
        }
        const json = (await res.json()) as ConversationData;
        if (!cancelled) applyConversation(json);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "加载失败");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyConversation]);

  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (!data?.state.pollAfterMs || !data.conversation.id) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          apiUrl(
            `/api/conversation?conversationId=${data.conversation.id}`,
          ),
        );
        if (!res.ok) return;
        const json = (await res.json()) as ConversationData;
        applyConversation(json);
      } catch {
        // ignore poll errors
      }
    }, data.state.pollAfterMs);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [data?.state.pollAfterMs, data?.conversation.id, applyConversation]);

  const handleSend = async (text: string) => {
    if (!data) return;
    const conversationId = data.conversation.id;
    const sentAt = Date.now();
    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      seq: (data.messages.at(-1)?.seq ?? 0) + 1,
      role: "user",
      content: { kind: "text", text, source: "chat" },
      createdAt: sentAt,
    };

    setData((prev) =>
      prev
        ? { ...prev, messages: [...prev.messages, optimisticMessage] }
        : prev,
    );
    setComposerText("");
    setThinking(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          text,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as ApiError;
        const msg = body.error?.message ?? "发送失败";
        setError(msg);
        const refreshed = await loadConversation(conversationId);
        const persisted = refreshed.messages.some(
          (message) =>
            message.role === "user" &&
            message.createdAt >= sentAt &&
            message.content.kind === "text" &&
            message.content.text === text,
        );
        if (!persisted) setComposerText(text);
        return;
      }
      const json = (await res.json()) as {
        messages: ChatMessage[];
        state: ConversationState;
      };
      setData((prev) =>
        prev
          ? {
              ...prev,
              messages: appendMessages(
                prev.messages.filter((message) => message.id !== optimisticId),
                json.messages,
              ),
              state: json.state,
            }
          : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败");
      setData((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.filter(
                (message) => message.id !== optimisticId,
              ),
            }
          : prev,
      );
      setComposerText(text);
    } finally {
      setThinking(false);
    }
  };

  const handleAction = async (action: ChatAction) => {
    if (!data) return;
    setLoadingAction(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/action"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: data.conversation.id,
          action,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as ApiError;
        throw new Error(body.error?.message ?? "操作失败");
      }
      const json = (await res.json()) as {
        messages: ChatMessage[];
        state: ConversationState;
      };
      setData((prev) =>
        prev
          ? {
              ...prev,
              messages: appendMessages(prev.messages, json.messages),
              state: json.state,
            }
          : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleUploadResume = async (file: File) => {
    if (!data) return;
    setLoadingAction(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("conversationId", data.conversation.id);
      form.append("file", file);
      const res = await fetch(apiUrl("/api/resume"), {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json()) as ApiError;
        throw new Error(body.error?.message ?? "上传失败");
      }
      const json = (await res.json()) as {
        messages: ChatMessage[];
        state: ConversationState;
      };
      setData((prev) =>
        prev
          ? {
              ...prev,
              messages: appendMessages(prev.messages, json.messages),
              state: json.state,
            }
          : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleNewConversation = async () => {
    if (
      !window.confirm(
        "开始新的对话？当前对话会保留在记录里。",
      )
    ) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/conversation/new"), {
        method: "POST",
      });
      if (!res.ok) {
        const body = (await res.json()) as ApiError;
        throw new Error(body.error?.message ?? "创建失败");
      }
      const json = (await res.json()) as ConversationData;
      applyConversation(json);
      setComposerText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    }
  };

  if (!data) {
    return (
      <div className="flex h-dvh items-center justify-center text-gray-500">
        加载中…
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-white text-base text-gray-900">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-semibold">就业服务智能体</h1>
        <button
          type="button"
          onClick={handleNewConversation}
          disabled={disabled}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
        >
          新对话
        </button>
      </header>

      <MessageList
        messages={data.messages}
        state={data.state}
        thinking={thinking}
        disabled={disabled}
        loadingAction={loadingAction}
        error={error}
        onAction={handleAction}
        onUploadResume={handleUploadResume}
      />

      <Composer
        value={composerText}
        onChange={setComposerText}
        onSend={handleSend}
        disabled={disabled}
      />
    </div>
  );
}
