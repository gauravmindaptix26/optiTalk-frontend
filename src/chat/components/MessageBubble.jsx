import React, { useEffect, useState } from "react";
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
  const [localMediaUrl, setLocalMediaUrl] = useState("");

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
  const tickColor = isRead ? "text-emerald-300" : "text-white/70";

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

  useEffect(() => {
    if (!(msg?.fileLocalPath instanceof File)) {
      setLocalMediaUrl("");
      return undefined;
    }

    const nextUrl = URL.createObjectURL(msg.fileLocalPath);
    setLocalMediaUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [msg]);

  return (
    <div className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
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
        className={`group relative w-fit max-w-[88%] rounded-[1.45rem] px-4 py-3 shadow-lg backdrop-blur-sm transition hover:-translate-y-[1px] sm:max-w-[75%] ${
          isSelf
            ? "bg-[linear-gradient(135deg,#34d399_0%,#22d3ee_18%,#2563eb_100%)] text-slate-950 shadow-cyan-950/25"
            : "border border-white/10 bg-white/[0.09] text-white shadow-slate-950/25"
        }`}
        {...longPressHandlers}
      >
        {!isSelf && (
          <div className="mb-2 inline-flex max-w-full rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.15em] text-cyan-100/70">
            {msg.senderUserID}
          </div>
        )}

        {reply && (
          <div
            className={`mb-2 border-l-2 pl-2 text-xs ${
              isSelf
                ? "border-slate-950/20 text-slate-900/75"
                : "border-white/30 text-purple-200"
            }`}
          >
            Replying to: {reply.text ?? ""}
          </div>
        )}

        {(attachment || isImage || isFile) && !msg.revoked && (
          <div
            className={`mb-3 overflow-hidden rounded-2xl border ${
              isSelf
                ? "border-slate-950/10 bg-white/30"
                : "border-white/10 bg-black/10"
            }`}
          >
            {isImage || attachment?.type?.startsWith("image/") ? (
              mediaUrl ? (
                <img
                  src={mediaUrl}
                  alt={fileLabel}
                  className="max-h-64 w-full object-cover"
                />
              ) : (
                <div className="px-3 py-4 text-xs text-purple-200">
                  Uploading image...
                </div>
              )
            ) : (
              <div className="flex items-center justify-between gap-3 px-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {fileLabel}
                  </div>
                  <div className="text-xs text-purple-200">
                    {msg?.fileSize || attachment?.size
                      ? `${attachment?.type || "file"} | ${Math.ceil((msg?.fileSize || attachment?.size) / 1024)} KB`
                      : attachment?.type || "file"}
                  </div>
                </div>
                {mediaUrl ? (
                  <a
                    href={mediaUrl}
                    download={fileLabel}
                    className={`rounded-xl px-3 py-2 text-xs ${
                      isSelf
                        ? "border border-slate-950/10 bg-slate-950/10 hover:bg-slate-950/15"
                        : "border border-white/10 bg-white/10 hover:bg-white/15"
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Download
                  </a>
                ) : (
                  <span className="text-xs text-purple-200">Uploading...</span>
                )}
              </div>
            )}
          </div>
        )}

        {showText && (
          <div
            className={`break-words whitespace-pre-wrap ${
              msg.revoked
                ? "italic text-purple-200"
                : isSelf
                  ? "text-slate-950"
                  : ""
            }`}
          >
            {displayContent}
          </div>
        )}

        <div
          className={`mt-1 flex items-center gap-2 text-[11px] ${
            isSelf ? "text-slate-950/70" : "text-purple-200"
          }`}
        >
          {formatTime(msg.timestamp)}
          {isSelf && <span className={tickColor}>{tick}</span>}
        </div>

        {showGroupReceiptSummary && (
          <button
            type="button"
            className={`mt-2 rounded-full px-2.5 py-1 text-[11px] transition ${
              isSelf
                ? "bg-slate-950/10 text-slate-950/75 hover:bg-slate-950/15"
                : "bg-white/10 text-purple-100 hover:bg-white/15"
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
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {Object.entries(reactionSummary).map(([emoji, count]) => {
              const isMine = reactions.some(
                (reaction) =>
                  reaction.reactionType === emoji && reaction.userID === selfUserID,
              );

              return (
                <span
                  key={`${msg.messageID ?? msg.localMessageID}-${emoji}`}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 ${
                    isSelf
                      ? "border border-slate-950/10 bg-white/35"
                      : "border border-white/20 bg-white/10"
                  } ${isMine ? "ring-1 ring-cyan-200/70" : ""}`}
                >
                  <span>{emoji}</span>
                  <span className="text-[10px]">{count}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
