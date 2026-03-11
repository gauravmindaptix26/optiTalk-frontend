import React, { useEffect, useMemo } from "react";
import { useLongPress } from "../hooks/useLongPress";
import { ZIMMessageType } from "../zego/zimConstants";
import {
  ATTACHMENT_PLACEHOLDER,
  parseMessageMetadata,
} from "../messageMetadata";

const formatTime = (timestamp) => {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function MessageBubble({
  msg,
  isSelf,
  selfUserID,
  onOpenPopover,
  receiptInfo,
  onOpenReceiptDetails,
}) {
  const metadata = parseMessageMetadata(msg.extendedData);
  const reply = metadata.replyTo ?? null;
  const attachment = metadata.attachment ?? null;
  const caption = String(metadata.caption || "").trim();

  const reactions = msg.reactions ?? [];
  const reactionSummary = reactions.reduce((acc, reaction) => {
    acc[reaction.reactionType] = (acc[reaction.reactionType] ?? 0) + 1;
    return acc;
  }, {});

  const isRead = msg.receiptStatus === 2;
  const isPending = !msg.messageID && !!msg.localMessageID;
  const tick = isPending
    ? "\u23F3"
    : isRead
      ? "\u2713\u2713"
      : msg.messageID
        ? "\u2713"
        : "\u23F3";
  const tickColor = isRead ? "text-emerald-200" : "text-white/72";

  const longPressHandlers = useLongPress(
    (_, target) => onOpenPopover?.(target),
    (_, target) => onOpenPopover?.(target),
  );

  const isText = msg?.type === ZIMMessageType.Text;
  const isImage = msg?.type === ZIMMessageType.Image;
  const isFile = msg?.type === ZIMMessageType.File;
  const mediaUrl =
    msg?.largeImageDownloadUrl ||
    msg?.fileDownloadUrl ||
    msg?.thumbnailDownloadUrl ||
    localMediaUrl;
  const fileLabel = msg?.fileName || attachment?.name || "Attachment";
  const displayContent = (() => {
    if (msg.revoked) return "Message deleted";
    if (isText) return msg.message;
    if (isImage || isFile) return caption;
    return msg?.message || "[Unsupported message type]";
  })();
  const showText = displayContent && displayContent !== ATTACHMENT_PLACEHOLDER;
  const readCount = Number(receiptInfo?.readMemberCount ?? 0);
  const unreadCount = Number(receiptInfo?.unreadMemberCount ?? 0);
  const showGroupReceiptSummary =
    isSelf &&
    msg?.conversationType === 2 &&
    !!msg?.messageID &&
    !msg?.revoked &&
    (readCount > 0 || unreadCount > 0);

  const localMediaUrl = useMemo(() => {
    if (!(msg?.fileLocalPath instanceof File)) return "";
    return URL.createObjectURL(msg.fileLocalPath);
  }, [msg?.fileLocalPath]);

  useEffect(
    () => () => {
      if (localMediaUrl) URL.revokeObjectURL(localMediaUrl);
    },
    [localMediaUrl],
  );

  return (
    <div className={`flex ${isSelf ? "justify-end" : "justify-start"} px-1`}>
      <div className={`flex max-w-[92%] items-end gap-3 sm:max-w-[78%] ${isSelf ? "flex-row-reverse" : ""}`}>
        {!isSelf && (
          <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xs font-semibold text-cyan-100/75 sm:flex">
            {(msg.senderUserID || "U").charAt(0).toUpperCase()}
          </div>
        )}
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => onOpenPopover?.(e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenPopover?.(e.currentTarget);
            }
          }}
          className={`group relative w-fit overflow-hidden rounded-[1.7rem] px-4 py-3.5 shadow-[0_18px_42px_rgba(2,8,23,0.18)] backdrop-blur-sm transition hover:-translate-y-[1px] ${
            isSelf
              ? "border border-cyan-200/10 bg-[linear-gradient(135deg,#2dd4bf_0%,#22d3ee_28%,#2563eb_100%)] text-slate-950"
              : "border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.045))] text-white"
          }`}
          {...longPressHandlers}
        >
          <div className="pointer-events-none absolute inset-0 opacity-70">
            <div
              className={`absolute inset-x-0 top-0 h-px ${
                isSelf ? "bg-white/35" : "bg-white/14"
              }`}
            />
          </div>

          {!isSelf && (
            <div className="mb-2 inline-flex max-w-full rounded-full border border-white/10 bg-black/12 px-2.5 py-1 text-[11px] uppercase tracking-[0.15em] text-cyan-100/75">
              {msg.senderUserID}
            </div>
          )}

          {reply && (
            <div
              className={`mb-3 rounded-2xl border-l-2 px-3 py-2 text-xs ${
                isSelf
                  ? "border-slate-950/18 bg-slate-950/10 text-slate-900/78"
                  : "border-cyan-300/40 bg-black/12 text-slate-200/85"
              }`}
            >
              <div className="mb-1 text-[10px] uppercase tracking-[0.16em] opacity-70">
                Reply
              </div>
              <div className="line-clamp-2">{reply.text ?? ""}</div>
            </div>
          )}

          {(attachment || isImage || isFile) && !msg.revoked && (
            <div
              className={`mb-3 overflow-hidden rounded-[1.25rem] border ${
                isSelf
                  ? "border-slate-950/10 bg-white/28"
                  : "border-white/10 bg-black/12"
              }`}
            >
              {isImage || attachment?.type?.startsWith("image/") ? (
                mediaUrl ? (
                  <img
                    src={mediaUrl}
                    alt={fileLabel}
                    className="max-h-72 w-full object-cover"
                  />
                ) : (
                  <div className="px-4 py-5 text-xs text-slate-200/82">
                    Uploading image...
                  </div>
                )
              ) : (
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {fileLabel}
                    </div>
                    <div className="mt-1 text-xs text-slate-200/82">
                      {msg?.fileSize || attachment?.size
                        ? `${attachment?.type || "file"} | ${Math.ceil((msg?.fileSize || attachment?.size) / 1024)} KB`
                        : attachment?.type || "file"}
                    </div>
                  </div>
                  {mediaUrl ? (
                    <a
                      href={mediaUrl}
                      download={fileLabel}
                      className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                        isSelf
                          ? "border border-slate-950/12 bg-slate-950/10 hover:bg-slate-950/15"
                          : "border border-white/10 bg-white/10 hover:bg-white/15"
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Download
                    </a>
                  ) : (
                    <span className="text-xs text-slate-200/82">Uploading...</span>
                  )}
                </div>
              )}
            </div>
          )}

          {showText && (
            <div
              className={`break-words whitespace-pre-wrap text-[0.95rem] leading-7 ${
                msg.revoked
                  ? "italic text-slate-200/82"
                  : isSelf
                    ? "text-slate-950"
                    : "text-white"
              }`}
            >
              {displayContent}
            </div>
          )}

          <div
            className={`mt-2 flex items-center gap-2 text-[11px] ${
              isSelf ? "text-slate-950/72" : "text-slate-300/82"
            }`}
          >
            {formatTime(msg.timestamp)}
            {isSelf && <span className={tickColor}>{tick}</span>}
          </div>

          {showGroupReceiptSummary && (
            <button
              type="button"
              className={`mt-3 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                isSelf
                  ? "bg-slate-950/10 text-slate-950/76 hover:bg-slate-950/15"
                  : "bg-white/10 text-slate-100 hover:bg-white/15"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onOpenReceiptDetails?.(msg);
              }}
            >
              {`Read by ${readCount}${unreadCount > 0 ? ` / ${readCount + unreadCount}` : ""}`}
            </button>
          )}

          {Object.keys(reactionSummary).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {Object.entries(reactionSummary).map(([emoji, count]) => {
                const isMine = reactions.some(
                  (reaction) =>
                    reaction.reactionType === emoji && reaction.userID === selfUserID,
                );

                return (
                  <span
                    key={`${msg.messageID ?? msg.localMessageID}-${emoji}`}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${
                      isSelf
                        ? "border border-slate-950/12 bg-white/32"
                        : "border border-white/15 bg-white/10"
                    } ${isMine ? "ring-1 ring-cyan-200/75" : ""}`}
                  >
                    <span>{emoji}</span>
                    <span className="text-[10px] font-medium">{count}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
