"use client";

import { useState, useCallback } from "react";
import type { CardPayload } from "@/lib/career/cards";
import { CardShell } from "./card-shell";
import { apiUrl } from "@/lib/api-base";
import { useAudioRecorder } from "../voice/use-audio-recorder";

type InterviewCard = Extract<CardPayload, { type: "interview_question" }>;

type InterviewQuestionCardProps = {
  card: InterviewCard;
  active: boolean;
  disabled?: boolean;
  answeredText?: string;
  onSubmit: (text: string, inputMethod?: "card" | "voice") => void;
  loadingAction?: boolean;
};

export function InterviewQuestionCardView({
  card,
  active,
  disabled,
  answeredText,
  onSubmit,
  loadingAction,
}: InterviewQuestionCardProps) {
  const [text, setText] = useState(answeredText ?? "");
  const [inputMethod, setInputMethod] = useState<"card" | "voice">("card");
  const [ttsLoading, setTtsLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const readOnly = !active || !!answeredText;
  const trimmed = text.trim();
  const canSubmit =
    active && !disabled && !loadingAction && !transcribing && trimmed.length >= 2;

  const { start, stop, isRecording, durationSec } = useAudioRecorder();

  const handleTts = useCallback(async () => {
    if (ttsLoading) return;
    setTtsLoading(true);
    try {
      const res = await fetch(apiUrl("/api/voice/tts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: card.text }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
        audio.onended = () => URL.revokeObjectURL(url);
      }
    } catch {
      /* silent */
    } finally {
      setTtsLoading(false);
    }
  }, [card.text, ttsLoading]);

  const handleRecordToggle = useCallback(async () => {
    if (isRecording) {
      const { blob, mimeType } = await stop();
      setTranscribing(true);
      try {
        const form = new FormData();
        form.append("audio", blob);
        form.append("mimeType", mimeType);
        const res = await fetch(apiUrl("/api/voice/asr"), {
          method: "POST",
          body: form,
        });
        if (res.ok) {
          const { text: t } = await res.json();
          if (t) {
            setText(t);
            setInputMethod("voice");
          }
        }
      } catch {
        /* silent */
      } finally {
        setTranscribing(false);
      }
    } else {
      try {
        await start();
      } catch {
        /* mic denied */
      }
    }
  }, [isRecording, start, stop]);

  return (
    <CardShell inactive={!active}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-gray-500">
          访谈 第 {card.index}/{card.total} 题
        </p>
        {active && !answeredText && (
          <button
            type="button"
            onClick={handleTts}
            disabled={ttsLoading}
            className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            {ttsLoading ? "朗读中…" : "🔊 朗读"}
          </button>
        )}
      </div>
      <p className="mb-4 text-base font-medium">{card.text}</p>
      {readOnly && answeredText ? (
        <p className="rounded-lg bg-gray-50 p-3 text-base text-gray-700">
          {answeredText}
        </p>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value.slice(0, 1000));
              setInputMethod("card");
            }}
            disabled={readOnly || disabled || transcribing}
            placeholder="说说你的真实想法…"
            rows={3}
            className="mb-2 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-base disabled:bg-gray-50"
          />
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {transcribing
                ? "正在转写…"
                : "也可以直接在下方输入框回答"}
            </p>
            {active && !answeredText && (
              <button
                type="button"
                onClick={handleRecordToggle}
                disabled={transcribing || loadingAction}
                className={`min-h-[36px] rounded-lg px-3 py-1 text-sm font-medium ${
                  isRecording
                    ? "bg-red-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                } disabled:opacity-50`}
              >
                {isRecording ? `停止 (${durationSec}s)` : "🎤 录音"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => canSubmit && onSubmit(trimmed, inputMethod)}
            disabled={!canSubmit}
            className="w-full rounded-lg bg-blue-600 py-3 text-base font-medium text-white disabled:opacity-40 min-h-[44px]"
          >
            {loadingAction ? "提交中…" : "提交回答"}
          </button>
        </>
      )}
    </CardShell>
  );
}
