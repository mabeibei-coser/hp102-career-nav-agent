"use client";

import { useCallback, useRef } from "react";

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  disabled?: boolean;
};

const MAX_LENGTH = 1000;
const WARN_LENGTH = 800;
const MAX_ROWS = 4;
const LINE_HEIGHT = 24;

export function Composer({ value, onChange, onSend, disabled }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = LINE_HEIGHT * MAX_ROWS + 16;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = value.trim();
      if (text && !disabled) {
        onSend(text);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value.slice(0, MAX_LENGTH);
    onChange(next);
    adjustHeight();
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div
      className="border-t border-gray-200 bg-white px-4 pt-3"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-[720px] items-end gap-2">
        <div className="relative min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="输入消息…"
            rows={1}
            className="w-full resize-none rounded-2xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-base leading-6 outline-none focus:border-blue-500 focus:bg-white disabled:opacity-50"
            style={{ minHeight: `${LINE_HEIGHT + 16}px` }}
          />
          {value.length > WARN_LENGTH && (
            <span className="absolute bottom-1 right-3 text-xs text-gray-400">
              {value.length}/{MAX_LENGTH}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => canSend && onSend(value.trim())}
          disabled={!canSend}
          className="shrink-0 rounded-full bg-blue-600 px-4 py-2.5 text-base font-medium text-white disabled:opacity-40"
        >
          发送
        </button>
      </div>
    </div>
  );
}
