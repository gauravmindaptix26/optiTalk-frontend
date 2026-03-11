import React from "react";

const iconButtonClass =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] text-slate-100 transition hover:-translate-y-[1px] hover:bg-white/[0.09]";

const MenuIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
    <path
      d="M4 6h12M4 10h12M4 14h8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
    <path
      d="M8.5 4a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9Zm7 11-2.8-2.8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const InfoIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
    <path
      d="M10 13.75V9.5m0-3.25h.01M17 10a7 7 0 1 1-14 0a7 7 0 0 1 14 0Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LogoutIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
    <path
      d="M12.5 5.5V4.75A1.75 1.75 0 0 0 10.75 3h-5A1.75 1.75 0 0 0 4 4.75v10.5C4 16.216 4.784 17 5.75 17h5a1.75 1.75 0 0 0 1.75-1.75v-.75M9.5 10h7m0 0-2.25-2.25M16.5 10l-2.25 2.25"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

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
    <header className="relative flex items-center gap-3 border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] px-3 py-3 backdrop-blur sm:gap-4 sm:px-6 sm:py-4">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/18 to-transparent" />
      <button
        type="button"
        className={`${iconButtonClass} lg:hidden`}
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
      >
        <MenuIcon />
      </button>
      {photo ? (
        <img
          src={photo}
          alt={title ?? "chat"}
          className="h-12 w-12 rounded-[1.2rem] border border-white/10 object-cover shadow-lg shadow-cyan-950/20 sm:h-[3.25rem] sm:w-[3.25rem]"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-gradient-to-br from-cyan-300 via-sky-400 to-indigo-500 text-lg font-semibold text-slate-950 shadow-lg shadow-cyan-950/25 sm:h-[3.25rem] sm:w-[3.25rem]">
          {title?.[0]?.toUpperCase() ?? "C"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[1rem] font-semibold sm:text-[1.15rem]">
          {title ?? "Select a chat"}
        </div>
        <div className="mt-0.5 truncate text-[11px] uppercase tracking-[0.2em] text-cyan-100/65">
          {metaLabel || "Live conversation"}
        </div>
        <div className="mt-1 truncate text-sm text-slate-300/82">
          {typingLabel || subtitle || "Messages stay synced across your workspace."}
        </div>
      </div>
      <button
        type="button"
        onClick={onToggleSearch}
        className={iconButtonClass}
        aria-label="Open message search"
      >
        <SearchIcon />
      </button>
      <button
        type="button"
        onClick={onToggleInfoPanel}
        className={`${iconButtonClass} 2xl:hidden`}
        aria-label="Open chat info"
      >
        <InfoIcon />
      </button>
      <button
        onClick={onLogout}
        className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3.5 py-2.5 text-sm font-medium text-white transition hover:-translate-y-[1px] hover:bg-white/[0.09] sm:px-4"
      >
        <LogoutIcon />
        <span className="hidden sm:inline">Log out</span>
      </button>
    </header>
  );
}
