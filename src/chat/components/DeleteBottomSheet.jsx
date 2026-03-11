import React, { useEffect } from "react";
import ReactDOM from "react-dom";

export default function DeleteBottomSheet({ message, onClose, onDelete }) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!message) return null;
  const isSelf = message?.isSelf;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 px-3 pb-3 backdrop-blur-sm">
      <div className="premium-panel w-full max-w-md rounded-[1.8rem] p-4">
        <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/18" />
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/65">
            Message actions
          </div>
          <div className="mt-2 text-sm text-slate-300/82">
            Delete this message?
          </div>
        </div>
        <div className="mt-4 space-y-2.5">
          <button
            className="w-full rounded-[1.2rem] border border-white/10 bg-white/6 py-3 text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/15"
            onClick={() => onDelete?.("me")}
          >
            Delete for me
          </button>
          {isSelf && (
            <button
              className="w-full rounded-[1.2rem] border border-red-400/20 bg-red-500/14 py-3 text-red-100 transition hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-300/25"
              onClick={() => onDelete?.("all")}
            >
              Delete for everyone
            </button>
          )}
          <button
            className="w-full rounded-[1.2rem] border border-white/10 bg-black/12 py-3 text-slate-200 transition hover:bg-white/8 focus:outline-none focus:ring-2 focus:ring-white/15"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
