import React from "react";
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
}) {
  const metadata = parseMessageMetadata(msg.extendedData);
  const reply = metadata.replyTo ?? null;
  const attachment = metadata.attachment ?? null;

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
  const displayContent = (() => {
    if (msg.revoked) return "Message deleted";
    if (isText) return msg.message;
    return msg?.message || "[Unsupported message type]";
  })();
  const showText = displayContent && displayContent !== ATTACHMENT_PLACEHOLDER;

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
        className={`group relative w-fit max-w-[88%] rounded-2xl px-4 py-3 transition hover:-translate-y-[1px] sm:max-w-[75%] ${
          isSelf
            ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
            : "border border-white/10 bg-white/10 text-white"
        }`}
        {...longPressHandlers}
      >
        {!isSelf && (
          <div className="mb-1 break-all text-xs text-purple-200">
            {msg.senderUserID}
          </div>
        )}

        {reply && (
          <div className="mb-2 border-l-2 border-white/30 pl-2 text-xs text-purple-200">
            Replying to: {reply.text ?? ""}
          </div>
        )}

        {attachment && !msg.revoked && (
          <div className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-black/10">
            {attachment.type?.startsWith("image/") ? (
              <img
                src={attachment.dataUrl}
                alt={attachment.name || "attachment"}
                className="max-h-64 w-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-between gap-3 px-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {attachment.name || "Attachment"}
                  </div>
                  <div className="text-xs text-purple-200">
                    {attachment.type || "file"}
                  </div>
                </div>
                <a
                  href={attachment.dataUrl}
                  download={attachment.name || "attachment"}
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
                  onClick={(e) => e.stopPropagation()}
                >
                  Download
                </a>
              </div>
            )}
          </div>
        )}

        {showText && (
          <div
            className={`break-words whitespace-pre-wrap ${
              msg.revoked ? "italic text-purple-200" : ""
            }`}
          >
            {displayContent}
          </div>
        )}

        <div
          className={`mt-1 flex items-center gap-2 text-[11px] ${
            isSelf ? "text-white/80" : "text-purple-200"
          }`}
        >
          {formatTime(msg.timestamp)}
          {isSelf && <span className={tickColor}>{tick}</span>}
        </div>

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
                  className={`flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-1 ${
                    isMine ? "ring-1 ring-white/60" : ""
                  }`}
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
