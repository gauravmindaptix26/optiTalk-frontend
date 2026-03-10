import React from "react";
import { getMessagePreview } from "../messageMetadata";

export default function ConversationList({
  conversations = [],
  active,
  onSelect,
  typingStatus,
  presenceByUserID = {},
}) {
  return (
    <div className="scrollbar-hidden h-full space-y-2 overflow-y-auto pr-1">
      {conversations.map((conversation) => {
        const isActive =
          active &&
          active.id === conversation.id &&
          active.type === conversation.type;
        const isTyping =
          typingStatus &&
          typingStatus.id === conversation.id &&
          typingStatus.type === conversation.type &&
          conversation.type === 0;

        const typeLabel =
          conversation.type === 2
            ? "Group"
            : conversation.type === 1
              ? "Room"
              : "Direct";

        const preview = isTyping
          ? "typing..."
          : getMessagePreview(conversation.lastMessage) ||
            conversation.subtitle ||
            "No messages yet";
        const presence =
          conversation.type === 0 ? presenceByUserID[conversation.id] : null;
        const presenceDotClass =
          presence?.presence === "online"
            ? "bg-emerald-400"
            : presence?.presence === "recent"
              ? "bg-cyan-300"
              : "bg-white/25";

        return (
          <button
            key={`${conversation.type}-${conversation.id}`}
            onClick={() => onSelect?.(conversation)}
            className={`w-full rounded-[1.35rem] border px-4 py-3 text-left transition duration-200 ${
              isActive
                ? "border-cyan-300/40 bg-white/14 shadow-lg shadow-cyan-950/30"
                : "border-white/10 bg-white/[0.045] hover:-translate-y-[1px] hover:border-white/25 hover:bg-white/[0.075]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-400 to-indigo-500 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/30">
                {conversation.title?.[0]?.toUpperCase() ?? "C"}
                {conversation.type === 0 && (
                  <span
                    className={`absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-[#101735] ${presenceDotClass}`}
                    title={presence?.presence || "unknown"}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate font-semibold text-white">
                    {conversation.title}
                  </div>
                  <span className="shrink-0 rounded-full border border-white/10 bg-black/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-cyan-100/80">
                    {typeLabel}
                  </span>
                </div>
                <div
                  className={`truncate text-xs ${
                    isTyping ? "text-cyan-200" : "text-purple-200"
                  }`}
                >
                  {preview}
                </div>
              </div>
              {conversation.unreadCount > 0 && (
                <span className="ml-auto shrink-0 rounded-full bg-cyan-400 px-2.5 py-1 text-[11px] font-semibold text-slate-950 shadow-md shadow-cyan-950/30">
                  {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                </span>
              )}
            </div>
          </button>
        );
      })}
      {conversations.length === 0 && (
        <div className="rounded-[1.35rem] border border-dashed border-white/15 bg-white/[0.04] px-4 py-6 text-center text-sm text-purple-200">
          Start a direct chat or create a group to see conversations here.
        </div>
      )}
    </div>
  );
}
