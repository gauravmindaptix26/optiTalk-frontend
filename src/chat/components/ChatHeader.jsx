import React from "react";

export default function ChatHeader({
  title,
  subtitle,
  onLogout,
  photo,
  typingLabel,
  onToggleSidebar,
}) {
  return (
    <header className="px-4 sm:px-6 py-4 border-b border-white/10 bg-white/5 backdrop-blur flex items-center gap-3 sm:gap-4">
      <button
        type="button"
        className="xl:hidden h-10 w-10 inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
      >
        <span className="block w-5 border-b border-white mb-1" />
        <span className="block w-5 border-b border-white mb-1" />
        <span className="block w-5 border-b border-white" />
      </button>
      {photo ? (
        <img
          src={photo}
          alt={title ?? "chat"}
          className="h-11 w-11 sm:h-12 sm:w-12 rounded-full object-cover border border-white/10"
        />
      ) : (
        <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-lg font-semibold">
          {title?.[0]?.toUpperCase() ?? "C"}
        </div>
      )}
      <div className="min-w-0">
        <div className="font-semibold text-base sm:text-lg truncate">{title ?? "Select a chat"}</div>
        <div className="text-sm text-purple-200 truncate">
          {typingLabel || subtitle || ""}
        </div>
      </div>
      <button
        onClick={onLogout}
        className="ml-auto px-3 sm:px-4 py-2 rounded-xl border border-white/20 hover:bg-white/10 transition text-sm sm:text-base"
      >
        Logout
      </button>
    </header>
  );
}
