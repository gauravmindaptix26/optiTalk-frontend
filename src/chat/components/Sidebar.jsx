import React, { useState } from "react";
import ConversationList from "./ConversationList";

const SearchIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
    <path
      d="M8.75 3.75a5 5 0 1 0 0 10a5 5 0 0 0 0-10Zm7.5 12.5l-3.2-3.2"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BoltIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
    <path
      d="m10.4 2.9-4.3 6.1h3.1L8.9 17.1l5-7h-3.2l-.3-7.2Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const GroupIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
    <path
      d="M7 9.25a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5Zm6 1a2 2 0 1 0 0-4a2 2 0 0 0 0 4ZM3.75 15a3.25 3.25 0 0 1 6.5 0v.5h-6.5V15Zm8 0a2.75 2.75 0 0 1 5.5 0v.5h-5.5V15Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SearchSkeleton = () => (
  <div className="premium-card flex items-center gap-3 rounded-[1.35rem] px-3 py-3">
    <div className="h-10 w-10 shrink-0 animate-pulse rounded-2xl bg-white/10" />
    <div className="min-w-0 flex-1 space-y-2">
      <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/10" />
      <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-white/5" />
    </div>
  </div>
);

const formatLastSeen = (timestamp) => {
  if (!timestamp) return "Last seen unknown";

  const deltaMs = Date.now() - Number(timestamp);
  const deltaMinutes = Math.max(1, Math.floor(deltaMs / 60000));

  if (deltaMinutes < 1) return "Active just now";
  if (deltaMinutes < 60) return `Last seen ${deltaMinutes}m ago`;

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `Last seen ${deltaHours}h ago`;

  const deltaDays = Math.floor(deltaHours / 24);
  if (deltaDays < 7) return `Last seen ${deltaDays}d ago`;

  return `Last seen ${new Date(timestamp).toLocaleDateString()}`;
};

const getPresenceBadge = (presence) => {
  if (presence === "online") {
    return {
      label: "Online",
      className: "bg-emerald-400/16 text-emerald-100 ring-1 ring-emerald-300/15",
    };
  }

  if (presence === "recent") {
    return {
      label: "Recent",
      className: "bg-cyan-400/14 text-cyan-100 ring-1 ring-cyan-300/15",
    };
  }

  return {
    label: "Offline",
    className: "bg-white/8 text-slate-200 ring-1 ring-white/10",
  };
};

const sectionShell =
  "premium-card rounded-[1.35rem] p-3 sm:rounded-[1.6rem] sm:p-4 [animation:fadeUp_320ms_ease]";
const inputShell =
  "w-full rounded-[1.15rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-400/90 outline-none transition focus:border-cyan-300/30 focus:bg-black/28 focus:ring-2 focus:ring-cyan-300/20";

export default function Sidebar({
  profile,
  onEditProfile,
  onCloseSidebar,
  conversations,
  active,
  onSelect,
  onStartNewChat,
  onCreateGroup,
  onSearch,
  onGroupSearch,
  isConnected,
  typingStatus,
  searchResults,
  searchLoading,
  searchError,
  groupSearchResults,
  groupSearchLoading,
  groupSearchError,
  presenceByUserID,
}) {
  const [searchValue, setSearchValue] = useState("");
  const [groupMembersValue, setGroupMembersValue] = useState("");

  const displayName =
    profile?.displayName?.trim() ||
    (profile?.email ? profile.email.split("@")[0] : "User");
  const photo = profile?.photo;
  const showSearchEmpty =
    searchValue.trim().length > 0 &&
    !searchLoading &&
    !searchError &&
    (searchResults?.length || 0) === 0;
  const showGroupSearchEmpty =
    groupMembersValue.trim().length > 0 &&
    !groupSearchLoading &&
    !groupSearchError &&
    (groupSearchResults?.length || 0) === 0;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden sm:gap-4">
      <div className="relative overflow-hidden rounded-[1.55rem] border border-white/10 bg-[linear-gradient(135deg,rgba(14,165,233,0.24),rgba(59,130,246,0.12),rgba(12,20,34,0.22))] p-3.5 shadow-[0_24px_60px_rgba(2,8,23,0.3)] sm:rounded-[1.9rem] sm:p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(94,234,212,0.1),transparent_28%)]" />
        <div className="relative mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-100/75">
              Team chat
            </div>
            <div className="font-display mt-2 text-[1.15rem] font-semibold text-white sm:text-[1.35rem]">
              Pulse Workspace
            </div>
            <div className="mt-1 max-w-[16rem] text-[11px] leading-5 text-cyan-50/72 sm:text-xs">
              Modern messaging with cleaner threads, search, groups, and presence.
            </div>
          </div>
          <div
            className={`w-fit rounded-full px-3 py-1.5 text-[11px] font-medium shadow-lg ${
              isConnected
                ? "bg-emerald-400/16 text-emerald-100 ring-1 ring-emerald-300/15"
                : "bg-amber-400/16 text-amber-100 ring-1 ring-amber-300/15"
            }`}
          >
            {isConnected ? "Realtime ready" : "Reconnecting"}
          </div>
        </div>

        <div className="relative flex items-center gap-3 rounded-[1.2rem] border border-white/10 bg-black/18 p-3 backdrop-blur sm:rounded-[1.4rem]">
          <button
            type="button"
            onClick={onCloseSidebar}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-lg text-white/80 transition hover:bg-white/10 lg:hidden"
            aria-label="Close sidebar"
          >
            ×
          </button>
          {photo ? (
            <img
              src={photo}
              alt={displayName}
              className="h-14 w-14 rounded-[1.25rem] border border-white/10 object-cover shadow-lg shadow-cyan-950/20"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-cyan-300 via-sky-400 to-indigo-500 text-lg font-semibold text-slate-950 shadow-lg shadow-cyan-950/25">
              {displayName?.[0]?.toUpperCase() ?? "U"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-white">
              {displayName}
            </div>
            <div className="truncate text-xs text-cyan-100/70">
              {profile?.email || "Ready for chat"}
            </div>
            <button
              className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-white/82 transition hover:text-white"
              onClick={onEditProfile}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px]">
                ✦
              </span>
              Edit profile
            </button>
          </div>
        </div>
      </div>

      <div className={sectionShell}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">
            <span className="rounded-full bg-cyan-400/12 p-1 text-cyan-100">
              <SearchIcon />
            </span>
            Find people
          </div>
          <div className="text-[11px] text-slate-300/80">
            {searchLoading ? "Searching" : `${searchResults?.length || 0} results`}
          </div>
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <SearchIcon />
          </span>
          <input
            placeholder="Search users by name or email"
            value={searchValue}
            className={`${inputShell} pl-11`}
            onChange={(e) => {
              setSearchValue(e.target.value);
              onSearch?.(e.target.value);
            }}
          />
        </div>
        <div className="soft-scrollbar mt-3 max-h-44 space-y-2 overflow-y-auto pr-1 sm:max-h-56">
          {searchLoading &&
            Array.from({ length: 3 }).map((_, index) => (
              <SearchSkeleton key={`search-skeleton-${index}`} />
            ))}
          {searchError && (
            <div className="rounded-[1.2rem] border border-red-400/20 bg-red-500/10 px-3 py-3 text-xs text-red-200">
              {searchError}
            </div>
          )}
          {!searchLoading &&
            !searchError &&
            (searchResults || []).map((result) => {
              const presenceBadge = getPresenceBadge(result.presence);

              return (
                <button
                  key={result.userID || result.userId || result.email || result.name}
                  className="premium-card w-full rounded-[1.3rem] px-3 py-3 text-left text-sm text-white transition hover:-translate-y-[1px] hover:border-cyan-300/20 hover:bg-white/[0.08]"
                  onClick={() =>
                    onStartNewChat?.(
                      result.userID || result.userId || result.email || result.name,
                    )
                  }
                  type="button"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-indigo-500 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-950/25">
                      {(result.name || result.email || result.userId || "U")
                        ?.charAt(0)
                        ?.toUpperCase() || "U"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-semibold">
                          {result.name || result.email || result.userId}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${presenceBadge.className}`}
                        >
                          {presenceBadge.label}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-300/78">
                        {result.email}
                      </div>
                      <div className="mt-1 truncate text-[11px] text-cyan-100/68">
                        {result.presence === "online"
                          ? "Available now"
                          : formatLastSeen(result.lastSeen)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          {!searchLoading && !searchError && !searchValue.trim() && (
            <div className="rounded-[1.25rem] border border-dashed border-white/12 bg-black/12 px-3 py-3 text-xs leading-5 text-slate-300/82">
              Search by email or name to start a direct conversation.
            </div>
          )}
          {showSearchEmpty && (
            <div className="rounded-[1.25rem] border border-dashed border-white/12 bg-black/12 px-3 py-3 text-xs leading-5 text-slate-300/82">
              No matching users found. Ask them to log in once so they appear in search.
            </div>
          )}
        </div>
      </div>

      <div className={sectionShell}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">
            <span className="rounded-full bg-cyan-400/12 p-1 text-cyan-100">
              <GroupIcon />
            </span>
            Create group
          </div>
          <div className="text-[11px] text-slate-300/80">
            {groupSearchLoading ? "Looking up" : "Direct + group"}
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = e.target.elements.groupName?.value?.trim();
            const membersRaw = groupMembersValue || "";
            const members = membersRaw
              .split(",")
              .map((member) => member.trim())
              .filter(Boolean);
            if (name) onCreateGroup?.({ name, members });
            e.target.reset();
            setGroupMembersValue("");
          }}
          className="space-y-3"
        >
          <input
            name="groupName"
            placeholder="Group name"
            className={inputShell}
            disabled={!isConnected}
          />
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <BoltIcon />
            </span>
            <input
              name="groupMembers"
              placeholder="Members (emails/userIDs, comma separated)"
              value={groupMembersValue}
              className={`${inputShell} pl-11`}
              disabled={!isConnected}
              onChange={(e) => {
                setGroupMembersValue(e.target.value);
                onGroupSearch?.(e.target.value);
              }}
            />
          </div>
          <div className="soft-scrollbar max-h-32 space-y-2 overflow-y-auto pr-1 sm:max-h-44">
            {groupSearchLoading &&
              Array.from({ length: 2 }).map((_, index) => (
                <SearchSkeleton key={`group-skeleton-${index}`} />
              ))}
            {groupSearchError && (
              <div className="rounded-[1.2rem] border border-red-400/20 bg-red-500/10 px-3 py-3 text-xs text-red-200">
                {groupSearchError}
              </div>
            )}
            {!groupSearchLoading &&
              !groupSearchError &&
              (groupSearchResults || []).map((result) => {
                const presenceBadge = getPresenceBadge(result.presence);

                return (
                  <button
                    key={result.userID || result.userId || result.email || result.name}
                    type="button"
                    className="premium-card w-full rounded-[1.2rem] px-3 py-3 text-left text-xs text-white transition hover:border-cyan-300/20 hover:bg-white/[0.08]"
                    onClick={() => {
                      const value =
                        result.userID ||
                        result.userId ||
                        result.email ||
                        result.name;
                      if (!value) return;

                      setGroupMembersValue((current) =>
                        current ? `${current}, ${value}` : value,
                      );
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-semibold">
                        {result.name || result.email || result.userId}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${presenceBadge.className}`}
                      >
                        {presenceBadge.label}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-[11px] text-slate-300/75">
                      {result.email}
                    </div>
                  </button>
                );
              })}
          </div>
          {!groupSearchLoading && !groupSearchError && !groupMembersValue.trim() && (
            <div className="rounded-[1.25rem] border border-dashed border-white/12 bg-black/12 px-3 py-3 text-xs leading-5 text-slate-300/82">
              Type member emails or user IDs, or tap search results to fill the field.
            </div>
          )}
          {showGroupSearchEmpty && (
            <div className="rounded-[1.25rem] border border-dashed border-white/12 bg-black/12 px-3 py-3 text-xs leading-5 text-slate-300/82">
              No eligible members found for this query yet.
            </div>
          )}
          <button
            type="submit"
            className="w-full rounded-[1.15rem] bg-[linear-gradient(135deg,#14b8a6_0%,#0ea5e9_40%,#2563eb_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(14,165,233,0.25)] transition hover:-translate-y-[1px] hover:shadow-[0_18px_36px_rgba(14,165,233,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isConnected}
          >
            Create group
          </button>
        </form>
      </div>

      <div className="premium-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.45rem] p-3 sm:rounded-[1.7rem] sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">
            Conversations
          </div>
          <div className="text-[11px] text-slate-300/78">
            {conversations?.length || 0} active
          </div>
        </div>
        <div className="min-h-0">
          <ConversationList
            conversations={conversations}
            active={active}
            onSelect={onSelect}
            typingStatus={typingStatus}
            presenceByUserID={presenceByUserID}
          />
        </div>
      </div>
    </div>
  );
}
