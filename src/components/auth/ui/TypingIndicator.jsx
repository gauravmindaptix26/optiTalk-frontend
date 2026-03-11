import React, { useEffect, useState } from "react";

const TypingIndicator = ({ delay }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (!show) return null;

  return (
    <div className="flex w-fit items-center gap-1 rounded-[1.3rem] border border-white/10 bg-white/[0.08] px-4 py-3 shadow-[0_18px_40px_rgba(2,8,23,0.2)] backdrop-blur">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-2.5 w-2.5 rounded-full bg-cyan-200/80 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
};

export default TypingIndicator;
