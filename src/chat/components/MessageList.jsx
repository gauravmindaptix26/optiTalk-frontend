import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import MessageBubble from "./MessageBubble";

const MessageActionsPopover = lazy(() => import("./MessageActionsPopover"));
const DeleteBottomSheet = lazy(() => import("./DeleteBottomSheet"));

const getDateKey = (timestamp) => {
  if (!timestamp) return "unknown";
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const formatDateLabel = (timestamp) => {
  if (!timestamp) return "Earlier";

  const today = new Date();
  const target = new Date(timestamp);
  const todayKey = getDateKey(today.getTime());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const targetKey = getDateKey(timestamp);
  if (targetKey === todayKey) return "Today";
  if (targetKey === getDateKey(yesterday.getTime())) return "Yesterday";

  return target.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year:
      target.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
};

export default function MessageList({
  messages,
  selfUserID,
  onReact,
  onReply,
  onForward,
  onDeleteForMe,
  onDeleteForAll,
}) {
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const [popover, setPopover] = useState({
    open: false,
    message: null,
    anchor: null,
  });
  const [sheet, setSheet] = useState({ open: false, message: null });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages?.length]);

  const rendered = useMemo(() => {
    const list = messages ?? [];
    const items = [];
    let lastDateKey = "";

    for (const message of list) {
      const dateKey = getDateKey(message?.timestamp);
      if (dateKey !== lastDateKey) {
        items.push({
          kind: "separator",
          key: `sep-${dateKey}-${message?.timestamp ?? items.length}`,
          label: formatDateLabel(message?.timestamp),
        });
        lastDateKey = dateKey;
      }

      items.push({
        kind: "message",
        key: message.messageID ?? message.localMessageID ?? `${message.timestamp}`,
        value: message,
      });
    }

    return items;
  }, [messages]);

  const openPopover = (message, anchorEl) => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    setPopover({
      open: true,
      message,
      anchor: {
        top: rect.top + window.scrollY,
        left: rect.left + rect.width / 2 + window.scrollX,
      },
    });
  };

  const closePopover = () =>
    setPopover({ open: false, message: null, anchor: null });

  const handleDeleteRequest = (message) => {
    setSheet({ open: true, message });
    closePopover();
  };

  return (
    <div className="relative flex h-full flex-col">
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-hidden overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.14),transparent_26%)] px-3 py-4 sm:px-6 sm:py-6"
      >
        <div className="space-y-3">
          {rendered.map((item) => {
            if (item.kind === "separator") {
              return (
                <div key={item.key} className="flex justify-center py-1">
                  <div className="rounded-full border border-white/10 bg-slate-950/55 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100/70 backdrop-blur">
                    {item.label}
                  </div>
                </div>
              );
            }

            const message = item.value;
            const isSelf = message.senderUserID === selfUserID;

            return (
              <MessageBubble
                key={item.key}
                msg={message}
                isSelf={isSelf}
                selfUserID={selfUserID}
                onOpenPopover={(target) =>
                  openPopover({ ...message, isSelf }, target)
                }
              />
            );
          })}

          {rendered.length === 0 && (
            <div className="flex min-h-full items-center justify-center py-10">
              <div className="max-w-sm rounded-[1.75rem] border border-dashed border-white/15 bg-white/[0.05] px-6 py-8 text-center">
                <div className="text-[11px] uppercase tracking-[0.26em] text-cyan-100/65">
                  No messages yet
                </div>
                <div className="mt-3 text-base font-semibold text-white">
                  Start this conversation with a clean first message.
                </div>
                <div className="mt-2 text-sm text-purple-200">
                  Replies, reactions, attachments and receipts will appear here.
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      <Suspense fallback={null}>
        {popover.open && (
          <MessageActionsPopover
            anchor={popover.anchor}
            message={popover.message}
            onClose={closePopover}
            onReact={(message, emoji) => {
              onReact?.(message, emoji);
              closePopover();
            }}
            onReply={(message) => {
              onReply?.(message);
              closePopover();
            }}
            onForward={(message) => {
              onForward?.(message);
              closePopover();
            }}
            onDeleteRequest={handleDeleteRequest}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {sheet.open && (
          <DeleteBottomSheet
            message={sheet.message}
            onClose={() => setSheet({ open: false, message: null })}
            onDelete={(scope) => {
              if (scope === "all") onDeleteForAll?.(sheet.message);
              else onDeleteForMe?.(sheet.message);
              setSheet({ open: false, message: null });
            }}
          />
        )}
      </Suspense>
    </div>
  );
}
