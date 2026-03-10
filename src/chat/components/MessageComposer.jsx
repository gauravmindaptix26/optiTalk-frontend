import React, { useEffect, useRef, useState } from "react";
import { ZIMMessageType } from "../zego/zimConstants";
import {
  ATTACHMENT_PLACEHOLDER,
  stringifyMessageMetadata,
} from "../messageMetadata";

const EMOJIS = [
  "\u{1F600}",
  "\u{1F602}",
  "\u{1F60D}",
  "\u{1F44D}",
  "\u{1F389}",
  "\u{1F525}",
  "\u{1F64F}",
  "\u{2764}\u{FE0F}",
];
const MAX_ATTACHMENT_BYTES = 120 * 1024;

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });

export default function MessageComposer({ onSend, disabled, onTyping }) {
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const pickerRef = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, 140);
    textarea.style.height = `${Math.max(nextHeight, 24)}px`;
  }, [text]);

  useEffect(() => {
    if (!pickerOpen) return undefined;

    const handleClickAway = (event) => {
      if (pickerRef.current?.contains(event.target)) return;
      setPickerOpen(false);
    };

    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, [pickerOpen]);

  const clearAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    const trimmed = text.trim();
    if ((!trimmed && !attachment) || disabled) return;

    const payload = {
      type: ZIMMessageType.Text,
      message: trimmed || ATTACHMENT_PLACEHOLDER,
    };

    if (attachment) {
      payload.extendedData = stringifyMessageMetadata({ attachment });
    }

    await onSend?.(payload);

    setText("");
    clearAttachment();
    setError("");
    setPickerOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
  };

  const insertEmoji = (emoji) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? text.length;
    const end = textarea?.selectionEnd ?? text.length;
    const nextValue = `${text.slice(0, start)}${emoji}${text.slice(end)}`;

    setText(nextValue);
    setPickerOpen(false);
    setError("");

    requestAnimationFrame(() => {
      textarea?.focus();
      const nextPosition = start + emoji.length;
      textarea?.setSelectionRange(nextPosition, nextPosition);
    });
  };

  const handleAttachmentSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(`Attachment too large. Max ${formatBytes(MAX_ATTACHMENT_BYTES)}.`);
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAttachment({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl,
      });
      setError("");
    } catch (err) {
      setError(err?.message || "Could not attach file");
      event.target.value = "";
    }
  };

  return (
    <form
      onSubmit={submit}
      className="border-t border-white/10 bg-white/5 px-3 pb-3 pt-3 backdrop-blur sm:px-6 sm:pb-5"
    >
      {attachment && (
        <div className="mb-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{attachment.name}</div>
              <div className="text-xs text-purple-200">
                {attachment.type || "file"} | {formatBytes(attachment.size)}
              </div>
            </div>
            <button
              type="button"
              onClick={clearAttachment}
              className="rounded-lg px-2 py-1 text-xs text-red-200 hover:bg-red-500/10"
            >
              Remove
            </button>
          </div>
          {attachment.type.startsWith("image/") && (
            <img
              src={attachment.dataUrl}
              alt={attachment.name}
              className="mt-3 max-h-40 rounded-xl border border-white/10 object-cover"
            />
          )}
        </div>
      )}

      {error && <div className="mb-3 text-sm text-red-200">{error}</div>}

      <div className="flex items-end gap-2 sm:gap-3">
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 text-sm transition hover:bg-white/10 sm:h-11 sm:w-11"
            aria-label="Add emoji"
            onClick={() => setPickerOpen((open) => !open)}
          >
            {"\u{1F642}"}
          </button>
          {pickerOpen && (
            <div className="absolute bottom-14 left-0 z-20 grid grid-cols-4 gap-2 rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-xl">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="rounded-xl bg-white/5 px-2 py-2 text-xl hover:bg-white/10"
                  onClick={() => insertEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 text-sm transition hover:bg-white/10 sm:h-11 sm:w-11"
          aria-label="Attach file"
          onClick={() => fileInputRef.current?.click()}
        >
          {"\u{1F4CE}"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleAttachmentSelect}
        />

        <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError("");
              onTyping?.();
            }}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
            placeholder={disabled ? "Connecting..." : "Type a message or add a file..."}
            className="max-h-35 w-full resize-none overflow-y-auto bg-transparent text-white placeholder:text-white/50 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={disabled || (!text.trim() && !attachment)}
          className="h-10 shrink-0 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 px-3 text-sm font-semibold text-white shadow-lg shadow-purple-900/30 transition hover:scale-[1.02] active:scale-[0.99] disabled:opacity-50 sm:h-11 sm:px-4"
        >
          Send
        </button>
      </div>
    </form>
  );
}
