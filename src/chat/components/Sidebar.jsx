import React from "react";
import ConversationList from "./ConversationList";

export default function Sidebar({
  profile,
  onEditProfile,
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
}) {
  const displayName =
    profile?.displayName?.trim() ||
    (profile?.email ? profile.email.split("@")[0] : "User");
  const photo = profile?.photo;
  return (
    <div className="h-full w-full rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl p-4 flex flex-col gap-4 shadow-xl shadow-purple-900/30">
      <div className="flex items-center gap-3">
        {photo ? (
          <img
            src={photo}
            alt={displayName}
            className="h-12 w-12 rounded-full object-cover border border-white/10"
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-lg font-semibold">
            {displayName?.[0]?.toUpperCase() ?? "U"}
          </div>
        )}
        <div className="min-w-0">
          <div className="font-semibold truncate">{displayName}</div>
          <button
            className="text-xs text-purple-200 hover:text-white"
            onClick={onEditProfile}
          >
            Edit profile
          </button>
        </div>
        <div
          className={`ml-auto text-xs px-2 py-1 rounded-full ${
            isConnected
              ? "bg-emerald-500/20 text-emerald-200"
              : "bg-yellow-500/20 text-yellow-200"
          }`}
        >
          {isConnected ? "Online" : "Connecting"}
        </div>
      </div>

      <div>
        <input
          placeholder="Search users..."
          className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400/60"
          onChange={(e) => onSearch?.(e.target.value)}
        />
        <div className="mt-2 space-y-1">
          {searchLoading && (
            <div className="text-xs text-purple-200">Searching...</div>
          )}
          {searchError && (
            <div className="text-xs text-red-200 break-words">{searchError}</div>
          )}
          {!searchLoading &&
            !searchError &&
            (searchResults || []).map((r) => (
              <button
                key={r.userID || r.userId || r.email || r.name}
                className="w-full text-left px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm text-white"
                onClick={() => onStartNewChat?.(r.userID || r.userId || r.email || r.name)}
                type="button"
              >
                <div className="font-semibold truncate">{r.name || r.email || r.userId}</div>
                <div className="text-xs text-purple-200 truncate">{r.email}</div>
              </button>
            ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
        <div className="text-xs text-purple-200 mb-2">Create a group</div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = e.target.elements.groupName?.value?.trim();
            const membersRaw = e.target.elements.groupMembers?.value || "";
            const members = membersRaw
              .split(",")
              .map((m) => m.trim())
              .filter(Boolean);
            if (name) onCreateGroup?.({ name, members });
            e.target.reset();
          }}
          className="space-y-2"
        >
          <input
            name="groupName"
            placeholder="Group name"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400/60"
            disabled={!isConnected}
          />
          <input
            name="groupMembers"
            placeholder="Members (emails/userIDs, comma separated)"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400/60"
            disabled={!isConnected}
            onChange={(e) => onGroupSearch?.(e.target.value)}
          />
          <div className="space-y-1">
            {groupSearchLoading && (
              <div className="text-xs text-purple-200">Searching members...</div>
            )}
            {groupSearchError && (
              <div className="text-xs text-red-200 break-words">{groupSearchError}</div>
            )}
            {!groupSearchLoading &&
              !groupSearchError &&
              (groupSearchResults || []).map((r) => (
                <button
                  key={r.userID || r.userId || r.email || r.name}
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-white"
                  onClick={(ev) => {
                    ev.preventDefault();
                    const formEl = ev.currentTarget.closest("form");
                    const input = formEl?.elements?.groupMembers;
                    const current = input?.value || "";
                    // Always use userID (sanitized) instead of email to avoid 6000001 errors
                    const val = r.userID || r.userId || r.email || r.name;
                    if (input && val) {
                      input.value = current ? `${current}, ${val}` : val;
                    }
                  }}
                >
                  <div className="font-semibold truncate text-sm">
                    {r.name || r.email || r.userId}
                  </div>
                  <div className="text-[11px] text-purple-200 truncate">{r.email}</div>
                </button>
              ))}
          </div>
          <button
            type="submit"
            className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm hover:bg-white/15 transition"
            disabled={!isConnected}
          >
            Create group
          </button>
        </form>
      </div>

      <div className="flex-1 min-h-0">
        <ConversationList
          conversations={conversations}
          active={active}
          onSelect={onSelect}
          typingStatus={typingStatus}
        />
      </div>
    </div>
  );
}
