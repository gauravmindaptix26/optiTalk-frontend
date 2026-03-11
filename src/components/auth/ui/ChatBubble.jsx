import React, { useEffect, useState } from "react";

const ChatBubble = ({ text, isUser, delay }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} transition-all duration-700 ${
        show ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      <div
        className={`max-w-sm rounded-[1.4rem] px-4 py-3 text-sm leading-6 shadow-[0_18px_40px_rgba(2,8,23,0.2)] ${
          isUser
            ? "bg-[linear-gradient(135deg,#14b8a6_0%,#0ea5e9_45%,#2563eb_100%)] text-white"
            : "border border-white/10 bg-white/[0.08] text-slate-100 backdrop-blur"
        }`}
      >
        {text}
      </div>
    </div>
  );
};

export default ChatBubble;
