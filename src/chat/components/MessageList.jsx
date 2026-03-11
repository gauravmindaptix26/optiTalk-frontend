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
  onTogglePin,
  onDeleteForMe,
  onDeleteForAll,
  receiptInfoByMessageID = {},
  receiptDetailState,
  onOpenReceiptDetails,
  onCloseReceiptDetails,
  highlightedMessageID = "",
  searchQuery = "",
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

  useEffect(() => {
    if (!highlightedMessageID || !scrollRef.current) return;
    const node = scrollRef.current.querySelector(
      `[data-message-id="${highlightedMessageID}"]`,
    );
    if (!node) return;
    node.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightedMessageID, rendered.length]);

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
        className="soft-scrollbar relative flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 sm:px-6 sm:py-6"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(94,234,212,0.08),transparent_24%),radial-gradient(circle_at_85%_10%,rgba(96,165,250,0.08),transparent_22%),radial-gradient(circle_at_bottom,rgba(16,185,129,0.05),transparent_26%)]" />
        <div className="pointer-events-none absolute inset-y-0 left-[14%] hidden w-px bg-gradient-to-b from-transparent via-white/6 to-transparent lg:block" />
        <div className="relative space-y-4">
          {!!searchQuery && (
            <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-cyan-100/78">
              Search active
              <span className="truncate normal-case tracking-normal text-white/88">
                {searchQuery}
              </span>
            </div>
          )}

          {rendered.map((item) => {
            if (item.kind === "separator") {
              return (
                <div key={item.key} className="flex justify-center py-1">
                  <div className="rounded-full border border-white/10 bg-[#09111d]/85 px-3.5 py-1.5 text-[11px] uppercase tracking-[0.18em] text-cyan-100/70 shadow-lg shadow-slate-950/20 backdrop-blur">
                    {item.label}
                  </div>
                </div>
              );
            }

            const message = item.value;
            const isSelf = message.senderUserID === selfUserID;

            return (
              <div
                key={item.key}
                data-message-id={message.messageID ?? message.localMessageID ?? ""}
                className={
                  highlightedMessageID &&
                  (message.messageID === highlightedMessageID ||
                    message.localMessageID === highlightedMessageID)
                    ? "rounded-[1.75rem] ring-2 ring-cyan-300/38 ring-offset-2 ring-offset-transparent transition"
                    : ""
                }
              >
                <MessageBubble
                  msg={message}
                  isSelf={isSelf}
                  selfUserID={selfUserID}
                  receiptInfo={receiptInfoByMessageID[message.messageID]}
                  onOpenReceiptDetails={onOpenReceiptDetails}
                  onOpenPopover={(target) =>
                    openPopover({ ...message, isSelf }, target)
                  }
                />
              </div>
            );
          })}

          {rendered.length === 0 && (
            <div className="flex min-h-full items-center justify-center py-10">
              <div className="premium-card max-w-md rounded-[1.9rem] px-6 py-8 text-center">
                <div className="text-[11px] uppercase tracking-[0.26em] text-cyan-100/65">
                  No messages yet
                </div>
                <div className="font-display mt-3 text-[1.1rem] font-semibold text-white">
                  Start this conversation with a clean first message.
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-300/82">
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
            onTogglePin={(message) => {
              onTogglePin?.(message);
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

      {receiptDetailState?.open && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/62 px-4 backdrop-blur-sm">
          <div className="premium-panel max-h-[78vh] w-full max-w-md overflow-hidden rounded-[1.8rem]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/65">
                  Delivery
                </div>
                <div className="text-sm font-semibold text-white">Read receipts</div>
                <div className="text-xs text-slate-300/78">
                  {(receiptDetailState.readMembers?.length || 0)} read, {(receiptDetailState.unreadMembers?.length || 0)} unread
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseReceiptDetails}
                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
              >
                ×
              </button>
            </div>
            <div className="soft-scrollbar max-h-[calc(78vh-74px)] space-y-4 overflow-y-auto p-4">
              {receiptDetailState.loading ? (
                <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] px-4 py-6 text-center text-sm text-slate-300/82">
                  Loading receipt details...
                </div>
              ) : receiptDetailState.error ? (
                <div className="rounded-[1.3rem] border border-red-400/20 bg-red-500/10 px-4 py-4 text-sm text-red-200">
                  {receiptDetailState.error}
                </div>
              ) : (
                <>
                  <div>
                    <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-cyan-100/65">
                      Read members
                    </div>
                    <div className="space-y-2">
                      {(receiptDetailState.readMembers || []).map((member) => (
                        <div
                          key={`read-${member.userID}`}
                          className="premium-card rounded-[1.25rem] px-3 py-3 text-sm text-white"
                        >
                          {member.userName || member.memberNickname || member.userID}
                        </div>
                      ))}
                      {!receiptDetailState.readMembers?.length && (
                        <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-black/10 px-3 py-3 text-xs text-slate-300/82">
                          No one has read this message yet.
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-cyan-100/65">
                      Unread members
                    </div>
                    <div className="space-y-2">
                      {(receiptDetailState.unreadMembers || []).map((member) => (
                        <div
                          key={`unread-${member.userID}`}
                          className="premium-card rounded-[1.25rem] px-3 py-3 text-sm text-white"
                        >
                          {member.userName || member.memberNickname || member.userID}
                        </div>
                      ))}
                      {!receiptDetailState.unreadMembers?.length && (
                        <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-black/10 px-3 py-3 text-xs text-slate-300/82">
                          Everyone in this group has read the message.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
