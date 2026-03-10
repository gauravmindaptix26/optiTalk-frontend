import React from "react";

export default function ChatHeader({
  title,
  subtitle,
  onLogout,
  photo,
  typingLabel,
  metaLabel,
  onToggleSearch,
  onToggleSidebar,
  onToggleInfoPanel,
}) {
  return (
    <header className="flex items-center gap-3 border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-3 py-3 backdrop-blur sm:gap-4 sm:px-6 sm:py-4">
      <button
        type="button"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/5 transition hover:bg-white/10 lg:hidden"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
      >
        <span className="mb-1 block w-5 border-b border-white" />
        <span className="mb-1 block w-5 border-b border-white" />
        <span className="block w-5 border-b border-white" />
      </button>
      {photo ? (
        <img
          src={photo}
          alt={title ?? "chat"}
          className="h-11 w-11 rounded-2xl border border-white/10 object-cover sm:h-12 sm:w-12"
        />
      ) : (
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-400 to-indigo-500 text-lg font-semibold text-slate-950 sm:h-12 sm:w-12">
          {title?.[0]?.toUpperCase() ?? "C"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold sm:text-lg">
          {title ?? "Select a chat"}
        </div>
        <div className="truncate text-[11px] uppercase tracking-[0.18em] text-cyan-100/65">
          {metaLabel || "Live conversation"}
        </div>
        <div className="truncate text-sm text-purple-200">
          {typingLabel || subtitle || ""}
        </div>
      </div>
      <button
        type="button"
        onClick={onToggleSearch}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-sm font-semibold transition hover:bg-white/10"
        aria-label="Open message search"
      >
        /
      </button>
      <button
        type="button"
        onClick={onToggleInfoPanel}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-sm font-semibold transition hover:bg-white/10 2xl:hidden"
        aria-label="Open chat info"
      >
        i
      </button>
      <button
        onClick={onLogout}
        className="ml-auto shrink-0 rounded-xl border border-white/20 bg-white/[0.04] px-3 py-2 text-xs transition hover:bg-white/10 sm:px-4 sm:text-sm"
      >
        Log out
      </button>
    </header>
  );
}
