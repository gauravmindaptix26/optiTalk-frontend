import React, { useState } from "react";
import ConversationList from "./ConversationList";

const SearchSkeleton = () => (
  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2.5">
    <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-white/10" />
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
      className: "bg-emerald-500/20 text-emerald-100",
    };
  }

  if (presence === "recent") {
    return {
      label: "Recent",
      className: "bg-cyan-400/15 text-cyan-100",
    };
  }

  return {
    label: "Offline",
    className: "bg-white/10 text-purple-100",
  };
};

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
    <div className="flex h-full w-full flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-purple-900/30 backdrop-blur-xl">
      <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(135deg,rgba(96,165,250,0.22),rgba(168,85,247,0.18),rgba(15,23,42,0.18))] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">
              Workspace
            </div>
            <div className="mt-1 text-lg font-semibold text-white">Pulse Chat</div>
          </div>
          <div
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
              isConnected
                ? "bg-emerald-500/20 text-emerald-100"
                : "bg-yellow-500/20 text-yellow-100"
            }`}
          >
            {isConnected ? "Online" : "Syncing"}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCloseSidebar}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm lg:hidden"
            aria-label="Close sidebar"
          >
            x
          </button>
          {photo ? (
            <img
              src={photo}
              alt={displayName}
              className="h-12 w-12 rounded-2xl border border-white/10 object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 via-sky-400 to-indigo-500 text-lg font-semibold text-slate-950">
              {displayName?.[0]?.toUpperCase() ?? "U"}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate font-semibold text-white">{displayName}</div>
            <div className="truncate text-xs text-cyan-100/75">
              {profile?.email || "Ready for chat"}
            </div>
            <button
              className="mt-1 text-xs text-purple-100 transition hover:text-white"
              onClick={onEditProfile}
            >
              Edit profile
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[1.45rem] border border-white/10 bg-white/[0.04] p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/65">
            Find People
          </div>
          <div className="text-[11px] text-purple-200">
            {searchLoading ? "Searching" : `${searchResults?.length || 0} results`}
          </div>
        </div>
        <input
          placeholder="Search users by name or email"
          value={searchValue}
          className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-2.5 text-sm text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
          onChange={(e) => {
            setSearchValue(e.target.value);
            onSearch?.(e.target.value);
          }}
        />
        <div className="mt-2 space-y-1.5">
          {searchLoading &&
            Array.from({ length: 3 }).map((_, index) => (
              <SearchSkeleton key={`search-skeleton-${index}`} />
            ))}
          {searchError && (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
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
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-left text-sm text-white transition hover:border-cyan-300/25 hover:bg-white/[0.08]"
                  onClick={() =>
                    onStartNewChat?.(
                      result.userID || result.userId || result.email || result.name,
                    )
                  }
                  type="button"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300 to-indigo-500 text-xs font-semibold text-slate-950">
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
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${presenceBadge.className}`}
                        >
                          {presenceBadge.label}
                        </span>
                      </div>
                      <div className="truncate text-xs text-purple-200">
                        {result.email}
                      </div>
                      <div className="mt-1 truncate text-[11px] text-cyan-100/70">
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
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-3 py-3 text-xs text-purple-200">
              Search by email or name to start a direct conversation.
            </div>
          )}
          {showSearchEmpty && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-3 py-3 text-xs text-purple-200">
              No matching users found. Ask them to log in once so they appear in search.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[1.45rem] border border-white/10 bg-white/[0.04] p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/65">
            Create Group
          </div>
          <div className="text-[11px] text-purple-200">
            {groupSearchLoading ? "Looking up members" : "Direct + group"}
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
          className="space-y-2"
        >
          <input
            name="groupName"
            placeholder="Group name"
            className="w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            disabled={!isConnected}
          />
          <input
            name="groupMembers"
            placeholder="Members (emails/userIDs, comma separated)"
            value={groupMembersValue}
            className="w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            disabled={!isConnected}
            onChange={(e) => {
              setGroupMembersValue(e.target.value);
              onGroupSearch?.(e.target.value);
            }}
          />
          <div className="space-y-1">
            {groupSearchLoading &&
              Array.from({ length: 2 }).map((_, index) => (
                <SearchSkeleton key={`group-skeleton-${index}`} />
              ))}
            {groupSearchError && (
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
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
                    className="w-full rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2 text-left text-xs text-white transition hover:border-cyan-300/25 hover:bg-white/[0.08]"
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
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${presenceBadge.className}`}
                      >
                        {presenceBadge.label}
                      </span>
                    </div>
                    <div className="truncate text-[11px] text-purple-200">
                      {result.email}
                    </div>
                  </button>
                );
              })}
          </div>
          {!groupSearchLoading && !groupSearchError && !groupMembersValue.trim() && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-3 py-3 text-xs text-purple-200">
              Type member emails or user IDs, or tap search results to fill the field.
            </div>
          )}
          {showGroupSearchEmpty && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-3 py-3 text-xs text-purple-200">
              No eligible members found for this query yet.
            </div>
          )}
          <button
            type="submit"
            className="w-full rounded-xl border border-cyan-300/20 bg-cyan-400/15 px-3 py-2 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/20"
            disabled={!isConnected}
          >
            Create group
          </button>
        </form>
      </div>

      <div className="min-h-0 flex-1">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/65">
            Conversations
          </div>
          <div className="text-[11px] text-purple-200">
            {conversations?.length || 0} active
          </div>
        </div>
        <ConversationList
          conversations={conversations}
          active={active}
          onSelect={onSelect}
          typingStatus={typingStatus}
          presenceByUserID={presenceByUserID}
        />
      </div>
    </div>
  );
}
