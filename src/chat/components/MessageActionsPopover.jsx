import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const actionClass =
  "rounded-xl px-2.5 py-1.5 text-sm text-slate-200 transition hover:bg-white/8 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/20";

const PopoverContent = ({
  anchor,
  message,
  onClose,
  onReact,
  onReply,
  onForward,
  onTogglePin,
  onDeleteRequest,
}) => {
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return;
      onClose?.();
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  if (!anchor || !message) return null;

  const style = {
    position: "absolute",
    top: anchor.top - 12,
    left: anchor.left,
    transform: "translate(-12%, -100%)",
    zIndex: 50,
  };

  return (
    <div ref={ref} style={style} className="premium-panel rounded-[1.4rem] px-3 py-3 text-white">
      <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-cyan-100/65">
        Quick actions
      </div>

      <div className="flex items-center gap-1">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            className="rounded-full bg-white/5 px-2.5 py-1.5 text-lg transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
            onClick={() => onReact?.(message, emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <button className={actionClass} onClick={() => onReply?.(message)}>
          Reply
        </button>
        <button className={actionClass} onClick={() => onForward?.(message)}>
          Forward
        </button>
        <button className={actionClass} onClick={() => onTogglePin?.(message)}>
          {message?.pinnedTime ? "Unpin" : "Pin"}
        </button>
        <button
          className="rounded-xl px-2.5 py-1.5 text-sm text-red-200 transition hover:bg-red-500/10 hover:text-red-100 focus:outline-none focus:ring-2 focus:ring-red-300/20"
          onClick={() => onDeleteRequest?.(message)}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default function MessageActionsPopover(props) {
  return ReactDOM.createPortal(<PopoverContent {...props} />, document.body);
}
