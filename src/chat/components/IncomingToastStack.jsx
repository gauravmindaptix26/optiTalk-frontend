import React from "react";

export default function IncomingToastStack({ toasts = [], onOpen, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[70] flex w-[min(92vw,24rem)] flex-col gap-2 sm:right-5 sm:top-5">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="premium-panel pointer-events-auto overflow-hidden rounded-[1.6rem]"
        >
          <div className="flex items-start gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => onOpen?.(toast)}
              className="flex min-w-0 flex-1 items-start gap-3 text-left"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.15rem] bg-gradient-to-br from-cyan-300 via-sky-400 to-indigo-500 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/25">
                {toast.title?.[0]?.toUpperCase() ?? "C"}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">
                  New message
                </div>
                <div className="truncate text-sm font-semibold text-white">
                  {toast.title}
                </div>
                <div className="mt-1 line-clamp-2 text-sm text-slate-300/85">
                  {toast.preview}
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onDismiss?.(toast.id)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm text-white/75 transition hover:bg-white/10 hover:text-white"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
          <div className="h-1 w-full bg-white/5">
            <div className="h-full w-full origin-left animate-[toastShrink_4.8s_linear_forwards] bg-gradient-to-r from-cyan-300 via-sky-400 to-indigo-500" />
          </div>
        </div>
      ))}
    </div>
  );
}
