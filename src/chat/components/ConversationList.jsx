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
    <div className="space-y-2.5">
      {conversations.map((conversation) => {
        const isActive =
          active &&
          active.id === conversation.id &&
          active.type === conversation.type;
        const isTyping =
          typingStatus &&
          typingStatus.id === conversation.id &&
          typingStatus.type === conversation.type;

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
            ? "bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.16)]"
            : presence?.presence === "recent"
              ? "bg-cyan-300 shadow-[0_0_0_4px_rgba(34,211,238,0.14)]"
              : "bg-slate-500";

        return (
          <button
            key={`${conversation.type}-${conversation.id}`}
            onClick={() => onSelect?.(conversation)}
            className={`group relative w-full overflow-hidden rounded-[1.45rem] border px-4 py-3 text-left transition duration-200 ${
              isActive
                ? "border-cyan-300/30 bg-[linear-gradient(135deg,rgba(94,234,212,0.14),rgba(96,165,250,0.12),rgba(255,255,255,0.08))] shadow-[0_20px_46px_rgba(8,47,73,0.25)]"
                : "border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] hover:-translate-y-[1px] hover:border-white/16 hover:bg-white/[0.075]"
            }`}
          >
            <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
              <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-cyan-300/35 to-transparent" />
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.15rem] bg-gradient-to-br from-cyan-300 via-sky-400 to-indigo-500 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/25">
                {conversation.title?.[0]?.toUpperCase() ?? "C"}
                {conversation.type === 0 && (
                  <span
                    className={`absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-[#09111f] ${presenceDotClass}`}
                    title={presence?.presence || "unknown"}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-[0.95rem] font-semibold text-white">
                    {conversation.title}
                  </div>
                  <span className="shrink-0 rounded-full border border-white/10 bg-black/18 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-100/80">
                    {typeLabel}
                  </span>
                </div>
                <div
                  className={`mt-1 truncate text-xs leading-5 ${
                    isTyping ? "text-cyan-200" : "text-slate-300/82"
                  }`}
                >
                  {preview}
                </div>
              </div>
              <div className="shrink-0 text-right">
                {conversation.unreadCount > 0 && (
                  <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-gradient-to-r from-cyan-300 to-sky-400 px-2.5 py-1 text-[11px] font-semibold text-slate-950 shadow-lg shadow-cyan-950/25">
                    {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
      {conversations.length === 0 && (
        <div className="rounded-[1.45rem] border border-dashed border-white/12 bg-black/12 px-4 py-8 text-center text-sm leading-6 text-slate-300/82">
          Start a direct chat or create a group to see conversations here.
        </div>
      )}
    </div>
  );
}
