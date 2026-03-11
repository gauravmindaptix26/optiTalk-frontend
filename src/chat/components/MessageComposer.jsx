import React, { useEffect, useRef, useState } from "react";
import { ZIMMessageType } from "../zego/zimConstants";
import { stringifyMessageMetadata } from "../messageMetadata";

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
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

const iconButtonClass =
  "inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] text-slate-100 transition hover:-translate-y-[1px] hover:bg-white/[0.09]";

const SmileIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
    <path
      d="M13.75 8h.008M6.25 8h.008M6.5 12.25c.7.83 1.85 1.35 3.5 1.35s2.8-.52 3.5-1.35M17 10a7 7 0 1 1-14 0a7 7 0 0 1 14 0Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PaperclipIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
    <path
      d="m7.25 10.75 4.88-4.88a2.25 2.25 0 1 1 3.18 3.18l-6.36 6.36a3.25 3.25 0 0 1-4.6-4.6l6-6"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
    <path
      d="M17 3 9.3 10.7M17 3l-5.2 14-2.2-6.6L3 8.2 17 3Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

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

  useEffect(
    () => () => {
      if (attachment?.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    },
    [attachment],
  );

  const clearAttachment = () => {
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    const trimmed = text.trim();
    if ((!trimmed && !attachment) || disabled) return;

    if (attachment) {
      const metadata = {
        attachment: {
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
        },
        caption: trimmed || "",
      };
      const payload = {
        type: attachment.type.startsWith("image/")
          ? ZIMMessageType.Image
          : ZIMMessageType.File,
        fileLocalPath: attachment.file,
        fileName: attachment.name,
        extendedData: stringifyMessageMetadata(metadata),
      };
      await onSend?.(payload);
    } else {
      const payload = {
        type: ZIMMessageType.Text,
        message: trimmed,
      };
      await onSend?.(payload);
    }

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
      if (attachment?.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
      setAttachment({
        file,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        previewUrl: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : "",
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
      className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(8,15,28,0.18),rgba(8,15,28,0.38))] px-3 pb-3 pt-3 backdrop-blur sm:px-6 sm:pb-5"
    >
      {attachment && (
        <div className="premium-card mb-3 rounded-[1.4rem] px-4 py-3 text-sm text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-semibold">{attachment.name}</div>
              <div className="mt-1 text-xs text-slate-300/80">
                {attachment.type || "file"} | {formatBytes(attachment.size)}
              </div>
            </div>
            <button
              type="button"
              onClick={clearAttachment}
              className="rounded-xl px-2 py-1 text-xs text-red-200 transition hover:bg-red-500/10"
            >
              Remove
            </button>
          </div>
          {attachment.previewUrl && (
            <img
              src={attachment.previewUrl}
              alt={attachment.name}
              className="mt-3 max-h-44 rounded-[1.1rem] border border-white/10 object-cover"
            />
          )}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-[1.15rem] border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="premium-card flex items-end gap-2 rounded-[1.75rem] px-3 py-3 sm:gap-3 sm:px-4">
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            className={iconButtonClass}
            aria-label="Add emoji"
            onClick={() => setPickerOpen((open) => !open)}
          >
            <SmileIcon />
          </button>
          {pickerOpen && (
            <div className="premium-panel absolute bottom-14 left-0 z-20 grid grid-cols-4 gap-2 rounded-[1.4rem] p-3 shadow-2xl">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="rounded-xl bg-white/5 px-2 py-2 text-xl transition hover:bg-white/10"
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
          className={iconButtonClass}
          aria-label="Attach file"
          onClick={() => fileInputRef.current?.click()}
        >
          <PaperclipIcon />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleAttachmentSelect}
        />

        <div className="flex min-h-[3.25rem] flex-1 items-end rounded-[1.4rem] border border-white/10 bg-black/18 px-4 py-3">
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
            className="soft-scrollbar max-h-36 w-full resize-none overflow-y-auto bg-transparent text-[0.95rem] leading-7 text-white placeholder:text-slate-400/90 outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={disabled || (!text.trim() && !attachment)}
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-[1.2rem] bg-[linear-gradient(135deg,#14b8a6_0%,#0ea5e9_42%,#2563eb_100%)] px-4 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(14,165,233,0.25)] transition hover:-translate-y-[1px] hover:shadow-[0_22px_40px_rgba(14,165,233,0.28)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SendIcon />
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>
    </form>
  );
}
