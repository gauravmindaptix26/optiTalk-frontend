import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { fetchZegoToken } from "./zego/token";
import {
  createZim,
  enterRoomZim,
  getZim,
  leaveRoomZim,
  leaveGroupZim,
  loginZim,
  logoutZim,
  createGroupZim,
  dismissGroupZim,
  inviteToGroupZim,
  queryGroupInfoZim,
  removeFromGroupZim,
  queryGroupMembersZim,
  joinGroupZim,
  setGroupMemberRoleZim,
  transferGroupOwnerZim,
  updateGroupNameZim,
  updateGroupNoticeZim,
  updateGroupAvatarUrlZim,
} from "./zego/zimClient";
import {
  ZIMConnectionEvent,
  ZIMConversationType,
  ZIMMessagePriority,
  ZIMMessageType,
} from "./zego/zimConstants";
import ChatLayout from "./components/ChatLayout";
import Sidebar from "./components/Sidebar";
import ChatHeader from "./components/ChatHeader";
import MessageList from "./components/MessageList";
import MessageComposer from "./components/MessageComposer";
import IncomingToastStack from "./components/IncomingToastStack";
import { loadCachedMessages, saveCachedMessages } from "./storage/chatCache";
import { useProfile } from "../profile/useProfile";
import ProfilePanel from "../profile/ProfilePanel";
import { getZimSdk } from "./zego/zimSdk";
import { getApiBase } from "./helpers/apiBase";
import { getMessagePreview, mergeMessageMetadata } from "./messageMetadata";

const LAST_CONV_KEY = "zego:lastConversation";
const GROUP_ADMIN_KEY = "zego:groupAdmins";
const GROUP_ROLE = {
  Owner: 1,
  Admin: 2,
  Member: 3,
};

const toZegoUserID = (raw) =>
  String(raw ?? "")
    .trim()
    .toLowerCase()
    // Keep IDs within Zego's Web login limit and allowed character set.
    .replace(/[^a-z0-9._-]/g, "_")
    .replace(/@/g, "_")
    .slice(0, 32);

const convKey = (type, id) => `${type}:${id}`;
const messageIdentity = (message) =>
  message?.messageID ??
  message?.localMessageID ??
  `${message?.timestamp ?? "0"}:${message?.message ?? ""}`;

const splitMemberEntries = (entries = []) =>
  (Array.isArray(entries) ? entries : [entries])
    .flatMap((entry) => String(entry ?? "").split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);

const getUniqueMemberIDs = (entries, selfUserID = "") =>
  Array.from(
    new Set(
      splitMemberEntries(entries)
        .map(toZegoUserID)
        .filter(Boolean)
        .filter((id) => id !== selfUserID),
    ),
  );

const getZimErrorUsers = (resp) =>
  resp?.errorUserList || resp?.errorInviteeList || resp?.errorList || [];

const formatZimUserError = (userError) => {
  if (!userError) return "unknown";

  const id =
    userError.userID ||
    userError.memberID ||
    userError.id ||
    userError.invitee ||
    "unknown";
  const code = String(userError.code || userError.errorCode || "");
  const reason = String(
    userError.reason ||
      userError.message ||
      userError.errorMessage ||
      userError.errorMsg ||
      "",
  ).trim();

  if (code === "6000001" || reason.includes("6000001")) {
    return `${id} (user needs to login first)`;
  }

  return reason ? `${id} (${reason})` : String(id);
};

const mergeUniqueMessages = (previous, incoming) => {
  const next = [...(previous ?? [])];
  const seen = new Set(
    next.map((m) => m?.messageID ?? m?.localMessageID).filter(Boolean),
  );
  for (const msg of incoming ?? []) {
    const id = msg?.messageID ?? msg?.localMessageID;
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    next.push(msg);
  }
  return next;
};

const normalizeGroupInfo = (response, fallbackGroupID = "") => {
  const groupInfo = response?.groupInfo || response?.info || {};
  const baseInfo = groupInfo?.baseInfo || groupInfo;

  return {
    groupID: baseInfo?.groupID || groupInfo?.groupID || fallbackGroupID,
    groupName: baseInfo?.groupName || groupInfo?.groupName || fallbackGroupID,
    groupAvatarUrl:
      baseInfo?.groupAvatarUrl || groupInfo?.groupAvatarUrl || "",
    groupNotice: groupInfo?.groupNotice || baseInfo?.groupNotice || "",
    ownerUserID: groupInfo?.ownerUserID || baseInfo?.ownerUserID || "",
    memberCount:
      Number(
        groupInfo?.memberCount ??
          baseInfo?.memberCount ??
          groupInfo?.memberNumber ??
          baseInfo?.memberNumber ??
          0,
      ) || 0,
  };
};

const getGroupMemberRole = (member) =>
  Number(member?.memberRole ?? member?.role ?? 0);

const getGroupRoleLabel = (role) => {
  if (role === GROUP_ROLE.Owner) return "Owner";
  if (role === GROUP_ROLE.Admin) return "Admin";
  return "Member";
};

export default function ChatPage() {
  const { user, logout, isAuthenticated, isLoading, getIdTokenClaims } =
    useAuth0();
  const [status, setStatus] = useState({ phase: "idle", error: "" });
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messagesByConv, setMessagesByConv] = useState(() => ({}));
  const [showProfile, setShowProfile] = useState(false);
  const [cachedIdToken, setCachedIdToken] = useState(null);  // ✅ NEW: Cache Auth0 token
  const saveTimersRef = useRef(new Map());
  const activeRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [typingStatus, setTypingStatus] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchAbortRef = useRef(null);
  const [groupSearchResults, setGroupSearchResults] = useState([]);
  const [groupSearchLoading, setGroupSearchLoading] = useState(false);
  const [groupSearchError, setGroupSearchError] = useState("");
  const groupSearchAbortRef = useRef(null);
  const [groupMembers, setGroupMembers] = useState({});
  const [groupInfoByID, setGroupInfoByID] = useState({});
  const [receiptInfoByMessageID, setReceiptInfoByMessageID] = useState({});
  const [receiptDetailState, setReceiptDetailState] = useState({
    open: false,
    loading: false,
    message: null,
    readMembers: [],
    unreadMembers: [],
    error: "",
  });
  const [groupAdmins, setGroupAdmins] = useState(() => {
    try {
      const raw = localStorage.getItem(GROUP_ADMIN_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [groupInviteInput, setGroupInviteInput] = useState("");
  const [groupRemoveInput, setGroupRemoveInput] = useState("");
  const [groupNameInput, setGroupNameInput] = useState("");
  const [groupNoticeInput, setGroupNoticeInput] = useState("");
  const [groupAvatarInput, setGroupAvatarInput] = useState("");
  const [groupTransferOwnerInput, setGroupTransferOwnerInput] = useState("");
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearchInput, setMessageSearchInput] = useState("");
  const [focusedMessageID, setFocusedMessageID] = useState("");
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [presenceByUserID, setPresenceByUserID] = useState({});
  const visibilityRef = useRef(
    typeof document !== "undefined" ? document.visibilityState : "visible",
  );
  const notificationPermissionRequestedRef = useRef(false);
  const browserNotificationTimestampsRef = useRef(new Map());
  const lastNotifiedMessageRef = useRef(new Map());
  const browserNotificationsRef = useRef(new Map());
  const receiptRefreshTimeoutRef = useRef(null);
  const activeMessages = useMemo(
    () =>
      active ? messagesByConv[convKey(active.type, active.id)] ?? [] : [],
    [active, messagesByConv],
  );

  useEffect(() => {
    activeRef.current = active;
    setTypingStatus(null);
    setReceiptDetailState((prev) =>
      prev.open
        ? {
            open: false,
            loading: false,
            message: null,
            readMembers: [],
            unreadMembers: [],
            error: "",
          }
        : prev,
    );
  }, [active]);

  useEffect(() => {
    setMessageSearchInput("");
    setFocusedMessageID("");
    setPinnedMessages([]);
  }, [active?.id, active?.type]);

  useEffect(() => {
    if (!active) return;
    loadPinnedMessages(active).catch(() => {});
  }, [active?.id, active?.type, activeMessages.length]);

  useEffect(() => {
    if (active?.type !== ZIMConversationType.Group) {
      setGroupNameInput("");
      setGroupNoticeInput("");
      setGroupAvatarInput("");
      setGroupTransferOwnerInput("");
      return;
    }

    const groupInfo = groupInfoByID[active.id];
    setGroupNameInput(groupInfo?.groupName || active.title || "");
    setGroupNoticeInput(groupInfo?.groupNotice || "");
    setGroupAvatarInput(groupInfo?.groupAvatarUrl || "");
  }, [active, groupInfoByID]);

  const conversationsRef = useRef([]);
  const toastTimersRef = useRef(new Map());

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    const users = [...(searchResults || []), ...(groupSearchResults || [])];
    if (!users.length) return;

    setPresenceByUserID((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const user of users) {
        const id = toZegoUserID(user?.userID || user?.userId || user?.email || "");
        if (!id) continue;
        const nextValue = {
          presence: user?.presence || "unknown",
          lastSeen: user?.lastSeen || 0,
          name: user?.name || user?.email || id,
        };
        const currentValue = prev[id];
        if (
          currentValue?.presence === nextValue.presence &&
          currentValue?.lastSeen === nextValue.lastSeen &&
          currentValue?.name === nextValue.name
        ) {
          continue;
        }
        next[id] = nextValue;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [groupSearchResults, searchResults]);

  useEffect(() => () => {
    for (const timer of toastTimersRef.current.values()) {
      clearTimeout(timer);
    }
    toastTimersRef.current.clear();

    for (const notification of browserNotificationsRef.current.values()) {
      notification.close();
    }
    browserNotificationsRef.current.clear();
    if (receiptRefreshTimeoutRef.current) {
      clearTimeout(receiptRefreshTimeoutRef.current);
      receiptRefreshTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const handleVisibilityChange = () => {
      visibilityRef.current = document.visibilityState;
    };

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof Notification === "undefined" ||
      !isAuthenticated ||
      notificationPermissionRequestedRef.current ||
      Notification.permission !== "default"
    ) {
      return;
    }

    notificationPermissionRequestedRef.current = true;
    Notification.requestPermission().catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    try {
      localStorage.setItem(GROUP_ADMIN_KEY, JSON.stringify(groupAdmins));
    } catch {
      // ignore
    }
  }, [groupAdmins]);

  const appRoomID = useMemo(
    () => String(import.meta.env.VITE_ZEGO_ROOM_ID ?? "global"),
    [],
  );

  const email = user?.email ? String(user.email) : "";
  const userID = useMemo(() => toZegoUserID(email), [email]);
  const displayNameDefault = useMemo(() => {
    if (user?.name) return String(user.name);
    if (email) return String(email).split("@")[0];
    return userID;
  }, [email, user?.name, userID]);
  const logoutReturnTo =
    import.meta.env.VITE_AUTH0_LOGOUT_REDIRECT ||
    import.meta.env.VITE_AUTH0_REDIRECT_URI ||
    window.location.origin;

  const { profile, updateProfile } = useProfile({
    userKey: userID,
    email,
    defaultName: displayNameDefault,
    defaultPhoto: user?.picture ? String(user.picture) : "",
  });

  const userName = displayNameDefault;
  const profilePhoto = profile?.photo || (user?.picture ? String(user.picture) : "");

  const isConnected = status.phase === "connected";
  const messageSearchResults = useMemo(() => {
    const query = messageSearchInput.trim().toLowerCase();
    if (!query) return [];
    return activeMessages
      .filter((message) =>
        getMessagePreview(message).toLowerCase().includes(query) ||
        String(message.senderUserID || "").toLowerCase().includes(query),
      )
      .slice()
      .reverse();
  }, [activeMessages, messageSearchInput]);

  const markConversationAsRead = async (conversation) => {
    if (!conversation) return;
    try {
      const zim = getZim();
      await zim.sendConversationMessageReceiptRead(
        conversation.id,
        conversation.type,
      );
      if (conversation.type === ZIMConversationType.Group) {
        const key = convKey(conversation.type, conversation.id);
        const readableMessages = (messagesByConv[key] ?? []).filter(
          (message) =>
            message?.messageID &&
            !message?.revoked &&
            message?.senderUserID !== userID &&
            message?.receiptStatus !== 2,
        );
        if (readableMessages.length) {
          await zim.sendMessageReceiptsRead(
            readableMessages,
            conversation.id,
            conversation.type,
          );
        }
      }
    } catch {
      // ignore
    }
    setConversations((prev) => {
      let changed = false;
      const next = prev.map((c) => {
        if (c.id !== conversation.id || c.type !== conversation.type) {
          return c;
        }
        if ((c.unreadCount ?? 0) === 0) {
          return c;
        }
        changed = true;
        return { ...c, unreadCount: 0 };
      });
      return changed ? next : prev;
    });
  };

  const refreshConversationList = async () => {
    const zim = getZim();
    const result = await zim.queryConversationList(
      { count: 50 },
      {
        marks: [],
        conversationTypes: [
          ZIMConversationType.Peer,
          ZIMConversationType.Room,
          ZIMConversationType.Group,
        ],
        isOnlyUnreadConversation: false,
      },
    );

    const list = (result?.conversationList ?? []).map((c) => ({
      id: c.conversationID,
      type: c.type,
      title: c.conversationName || c.conversationID,
      subtitle: "",
      unreadCount: c.unreadMessageCount ?? 0,
      lastMessage: c.lastMessage ?? null,
    }));

    const current = activeRef.current;
    const adjusted = current
      ? list.map((c) =>
          c.id === current.id && c.type === current.type
            ? { ...c, unreadCount: 0 }
            : c,
        )
      : list;

    setConversations(adjusted);
    return adjusted;
  };

  const loadHistory = async ({ id, type }) => {
    const zim = getZim();
    const history = await zim.queryHistoryMessage(id, type, {
      count: 50,
      reverse: true,
    });
    setMessagesByConv((prev) => ({
      ...prev,
      [convKey(type, id)]: mergeUniqueMessages(
        history?.messageList ?? [],
        prev[convKey(type, id)],
      ),
    }));
  };

  const loadPinnedMessages = async (conversation) => {
    if (!conversation) {
      setPinnedMessages([]);
      return;
    }
    try {
      const zim = getZim();
      const result = await zim.queryPinnedMessageList(
        conversation.id,
        conversation.type,
      );
      setPinnedMessages(result?.messageList ?? []);
    } catch {
      setPinnedMessages([]);
    }
  };

  const focusThreadMessage = (message) => {
    const nextID = message?.messageID || message?.localMessageID || "";
    if (!nextID) return;
    setFocusedMessageID(nextID);
    setMessageSearchOpen(true);
  };

  const loadGroupMembers = async (groupID) => {
    if (!groupID) return;
    try {
      const resp = await queryGroupMembersZim({ groupID, count: 200 });
      const list =
        resp?.userList ||
        resp?.groupMemberList ||
        resp?.memberList ||
        [];
      setGroupMembers((prev) => ({ ...prev, [groupID]: list }));
      setGroupInfoByID((prev) => {
        const current = prev[groupID] || { groupID };
        return {
          ...prev,
          [groupID]: {
            ...current,
            memberCount: list.length || current.memberCount || 0,
          },
        };
      });
    } catch (e) {
      console.warn("Failed to load group members", e);
    }
  };

  const loadGroupInfo = async (groupID) => {
    if (!groupID) return;
    try {
      const resp = await queryGroupInfoZim({ groupID });
      const normalized = normalizeGroupInfo(resp, groupID);
      setGroupInfoByID((prev) => ({
        ...prev,
        [groupID]: {
          ...(prev[groupID] || {}),
          ...normalized,
        },
      }));
      if (normalized.groupName) {
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === groupID &&
            conversation.type === ZIMConversationType.Group
              ? { ...conversation, title: normalized.groupName }
              : conversation,
          ),
        );
      }
    } catch (e) {
      console.warn("Failed to load group info", e);
    }
  };

  const ensureGroupJoined = async (groupID) => {
    if (!groupID) return;
    try {
      await joinGroupZim({ groupID });
    } catch (e) {
      const msg = (e?.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("exist")) return;
      console.warn("Join group failed", e);
      setStatus({ phase: "error", error: e?.message || "Join group failed" });
    }
  };

  const setActiveConversation = async (conversation) => {
    dismissToast(convKey(conversation.type, conversation.id));
    if (conversation?.lastMessage) {
      lastNotifiedMessageRef.current.set(
        convKey(conversation.type, conversation.id),
        messageIdentity(conversation.lastMessage),
      );
    }
    setActive(conversation);
    try {
      localStorage.setItem(
        LAST_CONV_KEY,
        JSON.stringify({ id: conversation.id, type: conversation.type }),
      );
    } catch {
      // ignore
    }

    if (conversation.type === ZIMConversationType.Group) {
      await ensureGroupJoined(conversation.id);
    }

    await loadHistory(conversation);
    if (conversation.type === ZIMConversationType.Group) {
      await Promise.all([
        loadGroupMembers(conversation.id),
        loadGroupInfo(conversation.id),
      ]);
    }
    await loadPinnedMessages(conversation);
    await markConversationAsRead(conversation);

    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversation.id && c.type === conversation.type
          ? { ...c, unreadCount: 0 }
          : c,
      ),
    );
  };

  const hydrateFromCache = (conversation) => {
    const key = convKey(conversation.type, conversation.id);
    setMessagesByConv((prev) => {
      if (prev[key]?.length) return prev;
      const cached = loadCachedMessages({
        conversationType: conversation.type,
        conversationID: conversation.id,
      });
      if (!cached.length) return prev;
      return { ...prev, [key]: cached };
    });
  };

  const dismissToast = (toastId) => {
    const timer = toastTimersRef.current.get(toastId);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(toastId);
    }

    setToasts((prev) => prev.filter((toast) => toast.id !== toastId));

    const activeNotification = browserNotificationsRef.current.get(toastId);
    if (activeNotification) {
      activeNotification.close();
      browserNotificationsRef.current.delete(toastId);
    }
  };

  const queueIncomingToast = ({ conversation, message }) => {
    if (!conversation || !message) return;

    const toastId = convKey(conversation.type, conversation.id);
    const currentMessageIdentity = messageIdentity(message);
    if (lastNotifiedMessageRef.current.get(toastId) === currentMessageIdentity) {
      return;
    }
    lastNotifiedMessageRef.current.set(toastId, currentMessageIdentity);

    const nextToast = {
      id: toastId,
      conversation,
      title: conversation.title || conversation.id,
      preview: getMessagePreview(message) || "New message",
    };

    const currentTimer = toastTimersRef.current.get(toastId);
    if (currentTimer) clearTimeout(currentTimer);

    setToasts((prev) => [nextToast, ...prev.filter((toast) => toast.id !== toastId)].slice(0, 3));

    const timeout = setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== toastId));
      toastTimersRef.current.delete(toastId);
    }, 4800);

    toastTimersRef.current.set(toastId, timeout);
  };

  const openConversationFromToast = async (toast) => {
    dismissToast(toast.id);
    setSidebarOpen(false);
    setInfoPanelOpen(false);
    hydrateFromCache(toast.conversation);
    await setActiveConversation(toast.conversation);
  };

  const notifyDesktopMessage = ({ conversation, message }) => {
    if (
      typeof window === "undefined" ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted" ||
      !conversation ||
      !message
    ) {
      return;
    }

    const isDocumentVisible =
      visibilityRef.current === "visible" && document.hasFocus?.();
    if (isDocumentVisible) return;

    const notificationKey = convKey(conversation.type, conversation.id);
    const lastShownAt =
      browserNotificationTimestampsRef.current.get(notificationKey) ?? 0;
    if (Date.now() - lastShownAt < 3500) return;
    browserNotificationTimestampsRef.current.set(notificationKey, Date.now());

    const previousNotification = browserNotificationsRef.current.get(notificationKey);
    if (previousNotification) {
      previousNotification.close();
      browserNotificationsRef.current.delete(notificationKey);
    }

    const notification = new Notification(conversation.title || "New message", {
      body: getMessagePreview(message) || "You have a new message",
      tag: notificationKey,
      renotify: true,
    });
    browserNotificationsRef.current.set(notificationKey, notification);

    notification.onclick = () => {
      window.focus();
      openConversationFromToast({
        id: notificationKey,
        conversation,
      }).catch(() => {});
      notification.close();
    };

    notification.onclose = () => {
      if (browserNotificationsRef.current.get(notificationKey) === notification) {
        browserNotificationsRef.current.delete(notificationKey);
      }
    };

    setTimeout(() => notification.close(), 5000);
  };

  const handleIncoming = (type, fromConversationID, list) => {
    const key = convKey(type, fromConversationID);
    const isActive =
      activeRef.current?.id === fromConversationID &&
      activeRef.current?.type === type;

    // Typing indicator detection for peer custom message.
    const typingMsg = (list ?? []).find(
      (m) =>
        m.type === ZIMMessageType.Custom &&
        m.subType === 1 &&
        m.message === "typing" &&
        m.senderUserID !== userID,
    );
    if (typingMsg) {
      setTypingStatus({
        id: fromConversationID,
        type,
        label:
          type === ZIMConversationType.Group
            ? `${typingMsg.senderUserID} is typing...`
            : "typing...",
      });
      setTimeout(() => {
        setTypingStatus((prev) =>
          prev &&
          prev.id === fromConversationID &&
          prev.type === type
            ? null
            : prev,
        );
      }, 2500);
      // do not add typing message into history
      return;
    }

    setMessagesByConv((prev) => ({
      ...prev,
      [key]: mergeUniqueMessages(prev[key], list),
    }));

    const lastMessage = list?.[list.length - 1] ?? null;
    const existingConversation = conversationsRef.current.find(
      (conversation) =>
        conversation.id === fromConversationID && conversation.type === type,
    );
    const inferredConversation =
      existingConversation ||
      {
        id: fromConversationID,
        type,
        title:
          type === ZIMConversationType.Room
            ? fromConversationID === appRoomID
              ? "Community"
              : fromConversationID
            : fromConversationID,
        subtitle: "",
        unreadCount: 0,
        lastMessage,
      };

    if (!isActive && lastMessage) {
      const notificationConversation = {
        ...inferredConversation,
        lastMessage: lastMessage ?? inferredConversation.lastMessage,
      };

      queueIncomingToast({
        conversation: notificationConversation,
        message: lastMessage,
      });
      notifyDesktopMessage({
        conversation: notificationConversation,
        message: lastMessage,
      });
    } else if (isActive && lastMessage) {
      lastNotifiedMessageRef.current.set(key, messageIdentity(lastMessage));
      dismissToast(key);
    }

    setConversations((prev) => {
      let found = false;

      const updated = prev.map((c) => {
        if (c.id !== fromConversationID || c.type !== type) return c;
        found = true;
        return {
          ...c,
          lastMessage: lastMessage ?? c.lastMessage,
          // If active, force unread to 0 so no badge/notification is shown.
          unreadCount: isActive ? 0 : (c.unreadCount ?? 0) + 1,
        };
      });

      if (found) return updated;

      const title =
        type === ZIMConversationType.Room
          ? fromConversationID === appRoomID
            ? "Community"
            : fromConversationID
          : fromConversationID;

      return [
        {
          id: fromConversationID,
          type,
          title,
          subtitle: "",
          // New conversation: if it's the active one, keep unread 0.
          unreadCount: isActive ? 0 : 1,
          lastMessage,
        },
        ...updated,
      ];
    });

    // If this conversation is currently open, proactively clear unread after state update
    if (isActive) {
      markActiveAsRead().catch(() => {});
    }
  };

  useEffect(() => {
    if (!active || active.type !== ZIMConversationType.Group) return undefined;

    const outgoingMessages = activeMessages
      .filter(
        (message) =>
          message?.senderUserID === userID &&
          message?.messageID &&
          !message?.revoked,
      )
      .slice(-20);

    if (!outgoingMessages.length) return undefined;

    let cancelled = false;
    receiptRefreshTimeoutRef.current = setTimeout(async () => {
      try {
        const zim = getZim();
        const result = await zim.queryMessageReceiptsInfo(
          outgoingMessages,
          active.id,
          active.type,
        );
        if (cancelled) return;

        const nextEntries = {};
        for (const info of result?.infos ?? []) {
          if (!info?.messageID) continue;
          nextEntries[info.messageID] = info;
        }

        if (Object.keys(nextEntries).length) {
          setReceiptInfoByMessageID((prev) => {
            let changed = false;
            const merged = { ...prev };
            for (const [messageID, value] of Object.entries(nextEntries)) {
              const current = prev[messageID];
              if (
                current?.readMemberCount === value?.readMemberCount &&
                current?.unreadMemberCount === value?.unreadMemberCount
              ) {
                continue;
              }
              merged[messageID] = value;
              changed = true;
            }
            return changed ? merged : prev;
          });
        }
      } catch {
        // ignore receipt refresh noise
      }
    }, 220);

    return () => {
      cancelled = true;
      if (receiptRefreshTimeoutRef.current) {
        clearTimeout(receiptRefreshTimeoutRef.current);
        receiptRefreshTimeoutRef.current = null;
      }
    };
  }, [active, activeMessages, userID]);

  const openReceiptDetails = async (message) => {
    if (!active || active.type !== ZIMConversationType.Group || !message) return;

    setReceiptDetailState({
      open: true,
      loading: true,
      message,
      readMembers: [],
      unreadMembers: [],
      error: "",
    });

    try {
      const zim = getZim();
      const queryConfig = { count: 200, nextFlag: 0 };
      const [readResult, unreadResult] = await Promise.all([
        zim.queryGroupMessageReceiptReadMemberList(message, active.id, queryConfig),
        zim.queryGroupMessageReceiptUnreadMemberList(message, active.id, queryConfig),
      ]);

      setReceiptDetailState({
        open: true,
        loading: false,
        message,
        readMembers: readResult?.userList ?? [],
        unreadMembers: unreadResult?.userList ?? [],
        error: "",
      });
    } catch (e) {
      setReceiptDetailState({
        open: true,
        loading: false,
        message,
        readMembers: [],
        unreadMembers: [],
        error: e?.message || "Could not load receipt details",
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    let conversationRefreshTimer = null;

    const boot = async () => {
      setStatus({ phase: "connecting", error: "" });

      try {
        if (!isAuthenticated) return;
        if (!email) throw new Error("Auth0 user email missing");
        if (!userID) throw new Error("Invalid userID generated from email");

        const idTokenClaims = await getIdTokenClaims();
        const idToken = idTokenClaims?.__raw;
        if (!idToken) throw new Error("Missing Auth0 ID token");
        
        // ✅ NEW: Cache the token for search operations
        setCachedIdToken(idToken);
        console.log(`[Chat] Cached Auth0 token successfully`);

        // Sync current user into backend directory store for search
        // ✅ This ensures user is marked as "active" and can be found in searches
        try {
          console.log(`[Chat] Syncing user "${userName}" with backend...`);
          const base = getApiBase();
          const meUrl = base ? `${base}/api/me` : "/api/me";
          const syncResp = await fetch(meUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              email,
              name: userName,
              picture: profilePhoto,
            }),
          });
          if (syncResp.ok) {
            console.log(`[Chat] ✅ User sync successful - user is now ACTIVE`);
          } else {
            console.warn(`[Chat] ⚠️ User sync returned ${syncResp.status}`);
          }
        } catch (syncErr) {
          console.warn(`[Chat] ⚠️ User sync failed:`, syncErr?.message);
        }

        const { token, userID: serverUserID } = await fetchZegoToken({
          authToken: idToken,
          userID,
        });
        const loginUserId = serverUserID || userID;

        await createZim();
        const zim = getZim();

        zim.off("peerMessageReceived");
        zim.off("roomMessageReceived");
        zim.off("groupMessageReceived");
        zim.off("connectionStateChanged");
        zim.off("tokenWillExpire");
        zim.off("conversationChanged");
        zim.off("messageReactionsChanged");
        zim.off("messageReceiptChanged");
        zim.off("messageRevokeReceived");
        zim.off("groupStateChanged");
        zim.off("groupMemberStateChanged");

        zim.on("peerMessageReceived", (_zim, data) => {
          if (cancelled) return;
          console.log(`[Chat] Received peer messages from ${data.fromConversationID}:`, data.messageList?.length || 0, "messages");
          handleIncoming(
            ZIMConversationType.Peer,
            data.fromConversationID,
            data.messageList,
          );
        });

        zim.on("groupMessageReceived", (_zim, data) => {
          if (cancelled) return;
          console.log(`[Chat] Received group messages in ${data.fromConversationID}:`, data.messageList?.length || 0, "messages");
          handleIncoming(
            ZIMConversationType.Group,
            data.fromConversationID,
            data.messageList,
          );
        });

        zim.on("roomMessageReceived", (_zim, data) => {
          if (cancelled) return;
          console.log(`[Chat] Received room messages in ${data.fromConversationID}:`, data.messageList?.length || 0, "messages");
          handleIncoming(
            ZIMConversationType.Room,
            data.fromConversationID,
            data.messageList,
          );
        });

        zim.on("messageReactionsChanged", (_zim, data) => {
          if (cancelled) return;
          const { reactions } = data;
          setMessagesByConv((prev) => {
            const next = { ...prev };
            for (const r of reactions ?? []) {
              const convKeyId = convKey(r.conversationType, r.conversationID);
              const existing = next[convKeyId] ?? [];
              next[convKeyId] = existing.map((m) =>
                m.messageID === r.messageID
                  ? { ...m, reactions: r.reactionList ?? [] }
                  : m,
              );
            }
            return next;
          });
        });

        zim.on("messageReceiptChanged", (_zim, data) => {
          if (cancelled) return;
          const { infos } = data;
          setMessagesByConv((prev) => {
            const next = { ...prev };
            let changed = false;
            for (const info of infos ?? []) {
              const key = convKey(info.conversationType, info.conversationID);
              const currentMessages = next[key] ?? [];
              let localChanged = false;
              const updatedMessages = currentMessages.map((m) => {
                if (m.messageID !== info.messageID) {
                  return m;
                }
                if (m.receiptStatus === info.receiptStatus) {
                  return m;
                }
                localChanged = true;
                return { ...m, receiptStatus: info.receiptStatus };
              });
              if (localChanged) {
                next[key] = updatedMessages;
                changed = true;
              }
            }
            return changed ? next : prev;
          });
        });

        zim.on("messageRevokeReceived", (_zim, data) => {
          if (cancelled) return;
          const revoked = data.messageList ?? [];
          setMessagesByConv((prev) => {
            const next = { ...prev };
            for (const m of revoked) {
              const key = convKey(m.conversationType, m.conversationID);
              next[key] = (next[key] ?? []).map((msg) =>
                msg.messageID === m.messageID
                  ? {
                      ...msg,
                      message: "Message deleted",
                      revoked: true,
                      extendedData: "",
                      reactions: [],
                    }
                  : msg,
              );
            }
            return next;
          });
        });

        const refreshActiveGroupMeta = () => {
          const current = activeRef.current;
          if (!current || current.type !== ZIMConversationType.Group) return;
          loadGroupMembers(current.id).catch(() => {});
          loadGroupInfo(current.id).catch(() => {});
        };

        zim.on("groupStateChanged", () => {
          if (cancelled) return;
          refreshConversationList().catch(() => {});
          refreshActiveGroupMeta();
        });

        zim.on("groupMemberStateChanged", () => {
          if (cancelled) return;
          refreshConversationList().catch(() => {});
          refreshActiveGroupMeta();
        });

        zim.on("conversationChanged", () => {
          if (cancelled) return;
          if (conversationRefreshTimer) clearTimeout(conversationRefreshTimer);
          conversationRefreshTimer = setTimeout(() => {
            refreshConversationList().catch(() => {});
          }, 250);
        });

        zim.on("connectionStateChanged", async (_zim, data) => {
          if (cancelled) return;
          if (
            data.event === ZIMConnectionEvent.ActiveLogin ||
            data.event === ZIMConnectionEvent.KickedOut
          ) {
            setStatus({
              phase: "duplicate",
              error: "Same email is already logged in on another tab/device.",
            });
            logoutZim();
            logout({ logoutParams: { returnTo: logoutReturnTo } });
          }
        });

        zim.on("tokenWillExpire", async () => {
          try {
            const renewedIdTokenClaims = await getIdTokenClaims();
            const renewedIdToken = renewedIdTokenClaims?.__raw;
            if (renewedIdToken) {
              const { token: newToken } = await fetchZegoToken({
                authToken: renewedIdToken,
                userID,
              });
              await zim.renewToken(newToken);
            }
          } catch (e) {
            console.error("ZIM token renew failed", e);
          }
        });

        try {
          console.log(`[Chat] Logging into Zego with userID="${loginUserId}"`);
          await loginZim({ userID: loginUserId, userName, token });
          console.log(`[Chat] ✅ Successfully logged into Zego - Status changing to "Online"`);
        } catch (loginErr) {
          console.error(`[Chat] ❌ Zego login failed:`, loginErr);
          if (cancelled) return;
          const errMsg = loginErr?.message || String(loginErr);
          const hint = /request timeout/i.test(errMsg)
            ? "Possible causes: duplicate login during dev reload, blocked WebSocket/network access, or invalid Zego app credentials."
            : "Possible causes: invalid token, app ID/server secret mismatch, or Zego connectivity issues.";
          setStatus({ 
            phase: "error", 
            error: `Zego connection failed: ${errMsg}. ${hint}` 
          });
          return;
        }
        if (cancelled) return;

        await enterRoomZim({ roomID: appRoomID, roomName: appRoomID });

        setStatus({ phase: "connected", error: "" });

        const list = await refreshConversationList();
        if (cancelled) return;

        let restored = null;
        try {
          const raw = localStorage.getItem(LAST_CONV_KEY);
          if (raw) restored = JSON.parse(raw);
        } catch {
          // ignore
        }

        const first =
          (restored &&
            list.find((c) => c.id === restored.id && c.type === restored.type)) ||
          list[0] ||
          null;

        if (first) {
          hydrateFromCache(first);
          await setActiveConversation(first);
        }
      } catch (e) {
        if (cancelled) return;
        setStatus({ phase: "error", error: e?.message || "Chat setup failed" });
      }
    };

    if (isAuthenticated && !isLoading) boot();

    return () => {
      cancelled = true;
      if (conversationRefreshTimer) clearTimeout(conversationRefreshTimer);
      leaveRoomZim({ roomID: appRoomID });
    };
  }, [
    appRoomID,
    email,
    getIdTokenClaims,
    isAuthenticated,
    isLoading,
    logout,
    userID,
    userName,
  ]);

  useEffect(() => {
    for (const c of conversations) {
      const key = convKey(c.type, c.id);
      const msgs = messagesByConv[key];
      if (!msgs || msgs.length === 0) continue;

      const existing = saveTimersRef.current.get(key);
      if (existing) clearTimeout(existing);

      const t = setTimeout(() => {
        saveTimersRef.current.delete(key);
        try {
          saveCachedMessages({
            conversationType: c.type,
            conversationID: c.id,
            messages: msgs,
          });
        } catch {
          // ignore
        }
      }, 350);

      saveTimersRef.current.set(key, t);
    }
  }, [conversations, messagesByConv]);

  useEffect(
    () => () => {
      for (const t of saveTimersRef.current.values()) clearTimeout(t);
      saveTimersRef.current.clear();
    },
    [],
  );

  const startNewChat = async (raw) => {
    const id = toZegoUserID(raw);
    if (!id) return;

    const next = {
      id,
      type: ZIMConversationType.Peer,
      title: raw,
      subtitle: "",
      unreadCount: 0,
      lastMessage: null,
    };

    setConversations((prev) => {
      const exists = prev.some((c) => c.id === next.id && c.type === next.type);
      if (exists) return prev;
      return [next, ...prev];
    });

    await setActiveConversation(next);
  };

  const _createGroup = async ({ name, members }) => {
    const cleanName = (name || "").trim();
    if (!cleanName) return;
    if (!isConnected) {
      setStatus({ phase: "error", error: "Connect first, then create a group" });
      return;
    }
    try {
      const invitees = getUniqueMemberIDs(members, userID);
      
      // ✅ VALIDATION: Warn user if they're trying to add no one or only themselves
      if (invitees.length === 0) {
        setStatus({
          phase: "error",
          error: "⚠️ No members selected. Please search and select members from the search results below to add to the group.",
        });
        return;
      }
      
      console.log(`[Group] Creating group "${cleanName}" with ${invitees.length} invitees`);

      // ✅ FIX: Create group WITHOUT including creator - Zego auto-adds creator
      // The creator should NOT be in the userIDs array for createGroup
      const result = await createGroupZim({
        groupName: cleanName,
        userIDs: [], // ← EMPTY array - creator is added automatically by Zego
      });

      const initialErrors =
        (result?.errorUserList || [])
          .map((u) => u?.userID || u?.memberID || u?.id || JSON.stringify(u))
          .filter(Boolean);
      
      // Note: Creator is automatically added by Zego, so we don't expect them in error list
      // Just log for debugging if any errors occur
      if (initialErrors.length) {
        console.warn(`[Chat] Group creation had some errors, but group should still be created:`, initialErrors);
      }

      const groupID =
        result?.groupInfo?.groupID ||
        result?.groupID ||
        result?.data?.groupID ||
        `group_${Date.now()}`;

      const newConv = {
        id: groupID,
        type: ZIMConversationType.Group,
        title: result?.groupInfo?.groupName || cleanName,
        subtitle: "",
        unreadCount: 0,
        lastMessage: null,
      };

      setGroupAdmins((prev) => ({ ...prev, [groupID]: userID }));
      setConversations((prev) => {
        const exists = prev.some(
          (c) => c.id === newConv.id && c.type === newConv.type,
        );
        if (exists) return prev;
        return [newConv, ...prev];
      });

      await setActiveConversation(newConv);
      await ensureGroupJoined(groupID);
      await loadGroupMembers(groupID);

      let inviteFailures = [];
      if (invitees.length) {
        console.log(`[Group Invite] Inviting ${invitees.length} users to group ${groupID}:`, invitees);
        for (const id of invitees) {
          try {
            console.log(`  [Invite] Sending invite for userID="${id}"`);
            const resp = await inviteToGroupZim({ groupID, userIDs: [id] });
            const errs =
              resp?.errorUserList ||
              resp?.errorInviteeList ||
              resp?.errorList ||
              [];
            if (errs.length) {
              console.error(`  [Invite ERROR] User "${id}" failed:`, errs);
              inviteFailures.push(id);
            } else {
              console.log(`  [Invite SUCCESS] User "${id}" added to group`);
            }
          } catch (e) {
            console.error(`  [Invite EXCEPTION] User "${id}":`, e?.message);
            inviteFailures.push(id);
          }
        }
      }

      if (inviteFailures.length) {
        console.error(`[Group] Invite failed for: ${inviteFailures.join(", ")}`);
        setStatus({
          phase: "error",
          error: `Group created but invites failed: ${inviteFailures.join(", ")}`,
        });
      } else {
        setStatus({ phase: "connected", error: "" });
      }
    } catch (e) {
      setStatus({ phase: "error", error: e?.message || "Group creation failed" });
    }
  };

  const createGroupFlow = async ({ name, members }) => {
    const cleanName = (name || "").trim();
    if (!cleanName) return;
    if (!isConnected) {
      setStatus({ phase: "error", error: "Connect first, then create a group" });
      return;
    }

    try {
      const invitees = getUniqueMemberIDs(members, userID);
      if (!invitees.length) {
        setStatus({
          phase: "error",
          error: "Select at least one valid member before creating the group.",
        });
        return;
      }

      const result = await createGroupZim({
        groupName: cleanName,
        userIDs: invitees,
      });

      const groupID =
        result?.groupInfo?.groupID ||
        result?.groupID ||
        result?.data?.groupID ||
        `group_${Date.now()}`;

      const newConv = {
        id: groupID,
        type: ZIMConversationType.Group,
        title: result?.groupInfo?.groupName || cleanName,
        subtitle: "",
        unreadCount: 0,
        lastMessage: null,
      };

      setGroupAdmins((prev) => ({ ...prev, [groupID]: userID }));
      setConversations((prev) => {
        const exists = prev.some(
          (conversation) =>
            conversation.id === newConv.id && conversation.type === newConv.type,
        );
        return exists ? prev : [newConv, ...prev];
      });

      await setActiveConversation(newConv);
      await ensureGroupJoined(groupID);

      let inviteFailures = getZimErrorUsers(result).map(formatZimUserError);
      if (inviteFailures.length) {
        const failedIDs = getZimErrorUsers(result)
          .map((item) => item?.userID || item?.memberID || item?.id || item?.invitee)
          .filter(Boolean);

        for (const failedID of failedIDs) {
          try {
            const retryResp = await inviteToGroupZim({ groupID, userIDs: [failedID] });
            const retryErrors = getZimErrorUsers(retryResp);
            if (!retryErrors.length) {
              inviteFailures = inviteFailures.filter(
                (entry) => entry !== failedID && !entry.startsWith(`${failedID} (`),
              );
            }
          } catch (retryError) {
            console.error(`[Group] Retry invite failed for "${failedID}"`, retryError);
          }
        }
      }

      await Promise.all([loadGroupMembers(groupID), loadGroupInfo(groupID)]);

      if (inviteFailures.length) {
        setStatus({
          phase: "error",
          error: `Group created, but some members could not be added: ${inviteFailures.join(", ")}`,
        });
      } else {
        setStatus({ phase: "connected", error: "" });
      }
    } catch (e) {
      setStatus({ phase: "error", error: e?.message || "Group creation failed" });
    }
  };

  const send = async (message) => {
    if (!active) return;
    const zim = getZim();
    const config = { priority: ZIMMessagePriority.Low, hasReceipt: true };
    console.log(`[Chat] Sending ${message.type === ZIMMessageType.Text ? "text" : "custom"} message to ${active.id} (${active.type})`, message.message);
    const result = await zim.sendMessage(message, active.id, active.type, config);
    console.log(`[Chat] Message sent, messageID=${result.message?.messageID}`);

    setMessagesByConv((prev) => {
      const key = convKey(active.type, active.id);
      return { ...prev, [key]: mergeUniqueMessages(prev[key], [result.message]) };
    });

    setConversations((prev) =>
      prev.map((c) =>
        c.id === active.id && c.type === active.type
          ? { ...c, lastMessage: result.message }
          : c,
      ),
    );
  };

  const markActiveAsRead = async () => {
    if (!active) return;
    try {
      const zim = getZim();
      await zim.sendConversationMessageReceiptRead(active.id, active.type);
      if (active.type === ZIMConversationType.Group) {
        const key = convKey(active.type, active.id);
        const readableMessages = (messagesByConv[key] ?? []).filter(
          (message) =>
            message?.messageID &&
            !message?.revoked &&
            message?.senderUserID !== userID &&
            message?.receiptStatus !== 2,
        );
        if (readableMessages.length) {
          await zim.sendMessageReceiptsRead(
            readableMessages,
            active.id,
            active.type,
          );
        }
      }
    } catch {
      // ignore
    }
    setConversations((prev) => {
      let changed = false;
      const next = prev.map((c) => {
        if (c.id !== active.id || c.type !== active.type) {
          return c;
        }
        if ((c.unreadCount ?? 0) === 0) {
          return c;
        }
        changed = true;
        return { ...c, unreadCount: 0 };
      });
      return changed ? next : prev;
    });
  };

  const handleReact = async (msg, emoji) => {
    const zim = getZim();
    const existing = (msg.reactions ?? []).find((r) => r.reactionType === emoji);
    if (existing) {
      await zim.deleteMessageReaction(emoji, msg);
    } else {
      await zim.addMessageReaction(emoji, msg);
    }
  };

  const handleTogglePin = async (msg) => {
    if (!active || !msg) return;
    try {
      const zim = getZim();
      const nextPinnedState = !msg.pinnedTime;
      await zim.pinMessage(msg, nextPinnedState);

      setMessagesByConv((prev) => {
        const key = convKey(active.type, active.id);
        return {
          ...prev,
          [key]: (prev[key] ?? []).map((message) =>
            message.messageID === msg.messageID
              ? {
                  ...message,
                  pinnedTime: nextPinnedState ? Date.now() : 0,
                  pinnedUserID: nextPinnedState ? userID : "",
                }
              : message,
          ),
        };
      });

      await loadPinnedMessages(active);
    } catch (e) {
      setStatus({ phase: "error", error: e?.message || "Pin update failed" });
    }
  };

  const handleReply = (msg) => {
    setReplyTo({
      id: msg.messageID ?? msg.localMessageID,
      text: msg.message,
      sender: msg.senderUserID,
    });
  };

  const handleForward = async (msg) => {
    if (!active) return;
    await send({
      type: ZIMMessageType.Text,
      message: msg.message,
      extendedData: msg.extendedData ?? "",
    });
  };

  const handleDeleteForMe = (msg) => {
    if (!active) return;
    const key = convKey(active.type, active.id);
    setMessagesByConv((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).filter(
        (m) =>
          m.messageID !== msg.messageID &&
          m.localMessageID !== msg.localMessageID,
      ),
    }));
  };

  const handleDeleteForAll = async (msg) => {
    try {
      const zim = getZim();
      await zim.revokeMessage(msg);
      const key = convKey(active.type, active.id);
      setMessagesByConv((prev) => ({
        ...prev,
        [key]: (prev[key] ?? []).map((m) =>
          (m.messageID && msg.messageID && m.messageID === msg.messageID) ||
          (!msg.messageID &&
            m.localMessageID &&
            msg.localMessageID &&
            m.localMessageID === msg.localMessageID)
            ? {
                ...m,
                message: "Message deleted",
                revoked: true,
                extendedData: "",
                reactions: [],
              }
            : m,
        ),
      }));
    } catch {
      // ignore
    }
  };

  const handleSend = async (payload) => {
    const base = { ...payload };
    if (replyTo) {
      base.extendedData = mergeMessageMetadata(base.extendedData, { replyTo });
    }
    await send(base);
    setReplyTo(null);
    await markActiveAsRead();
  };

  const _addMembersToGroup = async (groupID, entries) => {
    if (!groupID) return;
    const ids = Array.from(
      new Set(
        (entries || [])
          .map(toZegoUserID)
          .filter(Boolean)
          .filter((id) => id !== userID),
      ),
    );
    if (!ids.length) {
      setStatus({ phase: "error", error: "Add members failed: no valid userIDs" });
      return;
    }
    try {
      await ensureGroupJoined(groupID);
      console.log(`[Group] Adding members to ${groupID}:`, ids);
      const resp = await inviteToGroupZim({ groupID, userIDs: ids });
      console.log(`[Group] Invite response:`, resp);
      const errors =
        resp?.errorUserList ||
        resp?.errorInviteeList ||
        resp?.errorList ||
        [];
      if (errors.length) {
        const failed = errors
          .map((u) => u?.userID || u?.memberID || u?.id || JSON.stringify(u))
          .filter(Boolean);
        console.error(`[Group] Invite errors:`, failed);
        let errorMsg = `Add members failed: ${failed.join(", ")}`;
        if (failed.some(f => f.toLowerCase().includes("doesn't exist"))) {
          errorMsg += ". Note: Users must login to the app first before they can be added to groups.";
        }
        setStatus({ phase: "error", error: errorMsg });
      } else {
        setStatus({ phase: "connected", error: "" });
      }
      await loadGroupMembers(groupID);
    } catch (e) {
      console.error(`[Group] Add members exception:`, e);
      setStatus({ phase: "error", error: e?.message || "Add members failed" });
    }
  };

  const addMembersToGroupFlow = async (groupID, entries) => {
    if (!groupID) return;
    const ids = getUniqueMemberIDs(entries, userID);
    if (!ids.length) {
      setStatus({ phase: "error", error: "Add members failed: no valid userIDs" });
      return;
    }

    try {
      await ensureGroupJoined(groupID);
      const resp = await inviteToGroupZim({ groupID, userIDs: ids });
      const errors = getZimErrorUsers(resp);

      if (errors.length) {
        setStatus({
          phase: "error",
          error: `Add members failed: ${errors.map(formatZimUserError).join(", ")}`,
        });
      } else {
        setStatus({ phase: "connected", error: "" });
      }

      await Promise.all([loadGroupMembers(groupID), loadGroupInfo(groupID)]);
    } catch (e) {
      console.error("[Group] Add members flow failed", e);
      setStatus({ phase: "error", error: e?.message || "Add members failed" });
    }
  };

  const _removeMembersFromGroup = async (groupID, entries) => {
    if (!groupID) return;
    const ids = (entries || []).map(toZegoUserID).filter(Boolean);
    if (!ids.length) return;
    try {
      await removeFromGroupZim({ groupID, userIDs: ids });
      await loadGroupMembers(groupID);
      await loadGroupInfo(groupID);
    } catch (e) {
      setStatus({ phase: "error", error: e?.message || "Remove members failed" });
    }
  };

  const removeMembersFromGroupFlow = async (groupID, entries) => {
    if (!groupID) return;
    const ids = getUniqueMemberIDs(entries);
    if (!ids.length) return;

    try {
      await removeFromGroupZim({ groupID, userIDs: ids });
      await Promise.all([loadGroupMembers(groupID), loadGroupInfo(groupID)]);
      setStatus({ phase: "connected", error: "" });
    } catch (e) {
      setStatus({ phase: "error", error: e?.message || "Remove members failed" });
    }
  };

  const handleUpdateGroupName = async (groupID) => {
    const nextName = groupNameInput.trim();
    if (!groupID || !nextName) return;
    try {
      await updateGroupNameZim({ groupID, groupName: nextName });
      await loadGroupInfo(groupID);
      setStatus({ phase: "connected", error: "" });
    } catch (e) {
      setStatus({ phase: "error", error: e?.message || "Update group name failed" });
    }
  };

  const handleUpdateGroupNotice = async (groupID) => {
    if (!groupID) return;
    try {
      await updateGroupNoticeZim({ groupID, groupNotice: groupNoticeInput });
      await loadGroupInfo(groupID);
      setStatus({ phase: "connected", error: "" });
    } catch (e) {
      setStatus({ phase: "error", error: e?.message || "Update group notice failed" });
    }
  };

  const handleUpdateGroupAvatar = async (groupID) => {
    if (!groupID) return;
    try {
      await updateGroupAvatarUrlZim({
        groupID,
        groupAvatarUrl: groupAvatarInput,
      });
      await loadGroupInfo(groupID);
      setStatus({ phase: "connected", error: "" });
    } catch (e) {
      setStatus({ phase: "error", error: e?.message || "Update group avatar failed" });
    }
  };

  const removeGroupFromState = (groupID) => {
    setConversations((prev) =>
      prev.filter(
        (conversation) =>
          !(
            conversation.id === groupID &&
            conversation.type === ZIMConversationType.Group
          ),
      ),
    );
    setMessagesByConv((prev) => {
      const next = { ...prev };
      delete next[convKey(ZIMConversationType.Group, groupID)];
      return next;
    });
    setGroupMembers((prev) => {
      const next = { ...prev };
      delete next[groupID];
      return next;
    });
    setGroupInfoByID((prev) => {
      const next = { ...prev };
      delete next[groupID];
      return next;
    });
    setGroupAdmins((prev) => {
      const next = { ...prev };
      delete next[groupID];
      return next;
    });
    if (
      activeRef.current?.id === groupID &&
      activeRef.current?.type === ZIMConversationType.Group
    ) {
      setActive(null);
    }
  };

  const handleTransferGroupOwner = async (groupID) => {
    const nextOwner = toZegoUserID(groupTransferOwnerInput);
    if (!groupID || !nextOwner) {
      setStatus({ phase: "error", error: "Enter a valid new owner userID/email" });
      return;
    }
    if (nextOwner === userID) {
      setStatus({ phase: "error", error: "Choose another group member as the new owner" });
      return;
    }

    try {
      await transferGroupOwnerZim({ groupID, toUserID: nextOwner });
      setGroupAdmins((prev) => ({ ...prev, [groupID]: nextOwner }));
      setGroupTransferOwnerInput("");
      await Promise.all([loadGroupInfo(groupID), loadGroupMembers(groupID)]);
      setStatus({ phase: "connected", error: "" });
    } catch (e) {
      setStatus({ phase: "error", error: e?.message || "Transfer ownership failed" });
    }
  };

  const handleSetMemberRole = async (groupID, targetUserID, role) => {
    if (!groupID || !targetUserID) return;
    try {
      await setGroupMemberRoleZim({
        groupID,
        userID: targetUserID,
        role,
      });
      await Promise.all([loadGroupMembers(groupID), loadGroupInfo(groupID)]);
      setStatus({ phase: "connected", error: "" });
    } catch (e) {
      setStatus({ phase: "error", error: e?.message || "Update group role failed" });
    }
  };

  const handleLeaveGroup = async (groupID) => {
    if (!groupID) return;
    try {
      await leaveGroupZim({ groupID });
      removeGroupFromState(groupID);
      setInfoPanelOpen(false);
      setStatus({ phase: "connected", error: "" });
      await refreshConversationList().catch(() => {});
    } catch (e) {
      setStatus({ phase: "error", error: e?.message || "Leave group failed" });
    }
  };

  const handleDismissGroup = async (groupID) => {
    if (!groupID) return;
    try {
      await dismissGroupZim({ groupID });
      removeGroupFromState(groupID);
      setInfoPanelOpen(false);
      setStatus({ phase: "connected", error: "" });
      await refreshConversationList().catch(() => {});
    } catch (e) {
      setStatus({ phase: "error", error: e?.message || "Dismiss group failed" });
    }
  };

  const handleSearch = async ({ query, setter, setErr, setLoading, abortRef }) => {
    setErr("");
    const q = String(query || "").trim();
    if (!q) {
      setter([]);
      return;
    }
    try {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      
      // ✅ FIX: Use cached token first, then try to get fresh one
      let idToken = cachedIdToken;
      
      if (!idToken) {
        // Try to get fresh token with retry
        let retries = 3;
        while (!idToken && retries > 0) {
          try {
            idToken = (await getIdTokenClaims())?.__raw;
            if (idToken) {
              setCachedIdToken(idToken); // Cache it for next time
              break;
            }
          } catch (e) {
            console.warn(`[Search] Auth0 token attempt ${4 - retries} failed:`, e);
          }
          retries--;
          if (!idToken && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 200)); // Wait 200ms before retry
          }
        }
      }
      
      if (!idToken) {
        throw new Error("Could not get Auth0 token. Please ensure you are logged in.");
      }
      
      const base = getApiBase();
      const url = new URL(base ? `${base}/api/users` : "/api/users");
      if (q) url.searchParams.set("q", q);
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (controller.signal.aborted) return;
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Search failed (${res.status}): ${text}`);
      }
      const data = await res.json();
      setter(data?.results ?? []);
    } catch (e) {
      if (e?.name === "AbortError") return;
      setErr(e?.message || "Search failed");
      setter([]);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleUserSearch = (query) =>
    handleSearch({
      query,
      setter: setSearchResults,
      setErr: setSearchError,
      setLoading: setSearchLoading,
      abortRef: searchAbortRef,
    });

  const handleGroupSearch = (query) =>
    handleSearch({
      query,
      setter: setGroupSearchResults,
      setErr: setGroupSearchError,
      setLoading: setGroupSearchLoading,
      abortRef: groupSearchAbortRef,
    });

  const sendTyping = async () => {
    if (
      !active ||
      (active.type !== ZIMConversationType.Peer &&
        active.type !== ZIMConversationType.Group)
    ) {
      return;
    }
    if (typingTimeoutRef.current) return;
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2500);

    try {
      const { ZIMMessageType, ZIMMessagePriority } = await getZimSdk();
      const zim = getZim();
      const typingMessage = {
        type: ZIMMessageType.Custom ?? 200,
        message: "typing",
        subType: 1,
      };
      await zim.sendMessage(
        typingMessage,
        active.id,
        active.type,
        { priority: ZIMMessagePriority.Low },
      );
    } catch {
      // ignore
    }
  };

  const onLogout = () => {
    console.log("[Chat] Starting logout and clear all data...");
    
    // 1. Logout from Zego
    try {
      logoutZim();
      console.log("[Chat] Logged out from Zego");
    } catch (e) {
      console.error("[Chat] Error logging out from Zego:", e);
    }
    
    // 2. Clear all localStorage
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("zego:") || key.startsWith("profile:") || key.startsWith("auth"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log("[Chat] Cleared localStorage:", keysToRemove);
    } catch (e) {
      console.error("[Chat] Error clearing localStorage:", e);
    }
    
    // 3. Clear React state
    setConversations([]);
    setMessagesByConv({});
    setActive(null);
    setStatus({ phase: "idle", error: "" });
    setGroupMembers({});
    setGroupInfoByID({});
    setReceiptInfoByMessageID({});
    setReceiptDetailState({
      open: false,
      loading: false,
      message: null,
      readMembers: [],
      unreadMembers: [],
      error: "",
    });
    setGroupAdmins({});
    setSearchResults([]);
    setSearchError("");
    setGroupSearchResults([]);
    setGroupSearchError("");
    setTypingStatus(null);
    setReplyTo(null);
    setCachedIdToken(null);
    setGroupTransferOwnerInput("");
    setToasts([]);
    lastNotifiedMessageRef.current.clear();
    browserNotificationTimestampsRef.current.clear();
    for (const notification of browserNotificationsRef.current.values()) {
      notification.close();
    }
    browserNotificationsRef.current.clear();
    console.log("[Chat] Cleared React state");
    
    // 4. Logout from Auth0
    logout({ logoutParams: { returnTo: logoutReturnTo } });
    console.log("[Chat] Auth0 logout initiated");
  };

  if (isLoading) return <div className="p-6 text-white">Loading...</div>;
  if (!isAuthenticated) return <div className="p-6 text-white">Please login first.</div>;

  const subtitle =
    status.phase === "error"
      ? status.error
      : status.phase === "duplicate"
        ? status.error
        : status.phase === "connected"
          ? ""
          : "Connecting...";
  const activeGroupInfo =
    active?.type === ZIMConversationType.Group ? groupInfoByID[active.id] || null : null;
  const activeGroupMembers =
    active?.type === ZIMConversationType.Group ? groupMembers[active.id] || [] : [];
  const activeGroupMemberCount =
    activeGroupInfo?.memberCount || activeGroupMembers.length || 0;
  const currentGroupMember = activeGroupMembers.find(
    (member) =>
      (member?.userID || member?.memberID || "").toLowerCase() === userID,
  );
  const currentGroupRole = getGroupMemberRole(currentGroupMember);
  const isCurrentGroupOwner =
    currentGroupRole === GROUP_ROLE.Owner ||
    activeGroupInfo?.ownerUserID === userID;
  const isCurrentGroupAdmin =
    isCurrentGroupOwner ||
    currentGroupRole === GROUP_ROLE.Admin ||
    groupAdmins[active?.id] === userID;
  const headerMetaLabel =
    active?.type === ZIMConversationType.Group
      ? `${activeGroupMemberCount || 0} members | group chat`
      : active?.type === ZIMConversationType.Room
        ? "Community room"
        : active
          ? "Direct conversation"
          : "Live conversation";

  return (
    <>
      <ChatLayout
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        infoPanelOpen={infoPanelOpen}
        onCloseInfoPanel={() => setInfoPanelOpen(false)}
        sidebar={
          <Sidebar
            profile={profile}
            onCloseSidebar={() => setSidebarOpen(false)}
            onEditProfile={() => setShowProfile(true)}
            conversations={conversations}
            active={active}
            onSelect={(c) => {
              hydrateFromCache(c);
              setActiveConversation(c);
              setSidebarOpen(false);
            }}
          onStartNewChat={startNewChat}
          onCreateGroup={createGroupFlow}
          onGroupSearch={handleGroupSearch}
          groupSearchResults={groupSearchResults}
          groupSearchLoading={groupSearchLoading}
          groupSearchError={groupSearchError}
          isConnected={isConnected}
          typingStatus={typingStatus}
          presenceByUserID={presenceByUserID}
          onSearch={handleUserSearch}
          searchResults={searchResults}
          searchLoading={searchLoading}
            searchError={searchError}
          />
        }
        chatHeader={
          <ChatHeader
            title={active?.title ?? "Select a chat"}
            subtitle={subtitle}
            metaLabel={headerMetaLabel}
            typingLabel={
            typingStatus &&
            active &&
            typingStatus.id === active.id &&
            typingStatus.type === active.type
              ? typingStatus.label
              : ""
            }
            photo={undefined}
            onLogout={onLogout}
            onToggleSearch={() => {
              setSidebarOpen(false);
              setInfoPanelOpen(true);
              setMessageSearchOpen((prev) => !prev);
            }}
            onToggleSidebar={() => {
              setInfoPanelOpen(false);
              setSidebarOpen((prev) => !prev);
            }}
            onToggleInfoPanel={() => {
              setSidebarOpen(false);
              setInfoPanelOpen((prev) => !prev);
            }}
          />
        }
        messageList={
          status.phase === "error" ? (
            <div className="p-6">
              <div className="premium-card rounded-[1.7rem] border border-red-400/20 bg-red-500/10 p-5 text-white">
                <div className="font-display text-lg font-semibold">Chat setup error</div>
                <div className="mt-2 break-words text-red-200">{status.error}</div>
                <div className="mt-3 text-sm text-slate-300/82">
                  Check `frontend/.env` and backend `/api/token`.
                </div>
              </div>
            </div>
          ) : !active ? (
            <div className="flex h-full items-center justify-center px-6">
              <div className="premium-card max-w-xl rounded-[2rem] border border-dashed border-white/12 px-7 py-9 text-center">
                <div className="text-[11px] uppercase tracking-[0.26em] text-cyan-100/65">
                  No chat selected
                </div>
                <div className="font-display mt-3 text-[1.45rem] font-semibold text-white">
                  Pick a conversation or start a fresh one.
                </div>
                <div className="mt-3 text-sm leading-6 text-slate-300/82">
                  Search for a teammate, create a group, or open the sidebar from the hamburger menu on mobile.
                </div>
              </div>
            </div>
          ) : (
            <>
              <MessageList
                messages={activeMessages}
                selfUserID={userID}
                onReact={handleReact}
                onReply={handleReply}
                onForward={handleForward}
                onTogglePin={handleTogglePin}
                onDeleteForMe={handleDeleteForMe}
                onDeleteForAll={handleDeleteForAll}
                receiptInfoByMessageID={receiptInfoByMessageID}
                receiptDetailState={receiptDetailState}
                onOpenReceiptDetails={openReceiptDetails}
                onCloseReceiptDetails={() =>
                  setReceiptDetailState({
                    open: false,
                    loading: false,
                    message: null,
                    readMembers: [],
                    unreadMembers: [],
                    error: "",
                  })
                }
                highlightedMessageID={focusedMessageID}
                searchQuery={messageSearchInput}
              />
              <div className="px-6 pb-1 text-sm text-cyan-100/72">
                {typingStatus &&
                active &&
                typingStatus.id === active.id &&
                typingStatus.type === active.type
                  ? typingStatus.label
                  : ""}
              </div>
            </>
          )
        }
        composer={
          active ? (
            <MessageComposer onSend={handleSend} disabled={!isConnected} onTyping={sendTyping} />
          ) : null
        }
        rightPanel={
          <div className="premium-panel mesh-accent h-full w-full space-y-4 rounded-[2rem] p-4 text-sm text-slate-200/82">
            <div className="rounded-[1.7rem] border border-white/10 bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(59,130,246,0.14),rgba(15,23,42,0.2))] p-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">
                Chat info
              </div>
              <div className="font-display mt-2 text-xl font-semibold text-white">
                {active?.title || "Workspace overview"}
              </div>
              <div className="mt-1 text-xs text-cyan-100/75">
                {headerMetaLabel}
              </div>
            </div>

            <div className="premium-card grid gap-3 rounded-[1.45rem] p-3">
              <div className="text-xs text-slate-300/82">
                Signed in as <span className="font-semibold text-white">{user?.email || userID}</span>
              </div>
              <div className="text-xs text-slate-300/82">
                Current room: <span className="font-semibold text-white">{appRoomID}</span>
              </div>
              <div className="text-xs text-slate-300/82">
                Status: <span className="font-semibold text-white">{subtitle || "Ready"}</span>
              </div>
            </div>

            {active && (
              <div className="premium-card rounded-[1.45rem] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">Search messages</div>
                  <button
                    type="button"
                    className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] text-cyan-50 transition hover:bg-white/12"
                    onClick={() => setMessageSearchOpen((prev) => !prev)}
                  >
                    {messageSearchOpen ? "Hide" : "Open"}
                  </button>
                </div>
                {messageSearchOpen ? (
                  <div className="space-y-3">
                    <input
                      value={messageSearchInput}
                      onChange={(e) => setMessageSearchInput(e.target.value)}
                      placeholder="Search text, sender, caption..."
                      className="w-full rounded-xl border border-white/10 bg-black/18 px-3 py-2 text-xs text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
                    />
                    <div className="soft-scrollbar max-h-48 space-y-2 overflow-y-auto pr-1">
                      {(messageSearchInput.trim() ? messageSearchResults : []).map((message) => (
                        <button
                          key={`search-${message.messageID || message.localMessageID}`}
                          type="button"
                          className="premium-card w-full rounded-[1.2rem] px-3 py-2 text-left transition hover:bg-white/[0.08]"
                          onClick={() => focusThreadMessage(message)}
                        >
                          <div className="truncate text-xs font-medium text-white">
                            {message.senderUserID}
                          </div>
                          <div className="mt-1 truncate text-xs text-slate-300/82">
                            {getMessagePreview(message) || "Attachment"}
                          </div>
                        </button>
                      ))}
                      {messageSearchInput.trim() && !messageSearchResults.length && (
                        <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-black/10 px-3 py-3 text-xs text-slate-300/82">
                          No matching messages in this conversation yet.
                        </div>
                      )}
                      {!messageSearchInput.trim() && (
                        <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-black/10 px-3 py-3 text-xs text-slate-300/82">
                          Search runs inside the currently open conversation.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-300/82">
                    Tap open to search inside this conversation and jump to any message.
                  </div>
                )}
              </div>
            )}

            {active && (
              <div className="premium-card rounded-[1.45rem] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">Pinned messages</div>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200/82">
                    {pinnedMessages.length}
                  </span>
                </div>
                <div className="soft-scrollbar max-h-52 space-y-2 overflow-y-auto pr-1">
                  {pinnedMessages.map((message) => (
                    <button
                      key={`pinned-${message.messageID || message.localMessageID}`}
                      type="button"
                      className="premium-card w-full rounded-[1.2rem] px-3 py-2 text-left transition hover:bg-white/[0.08]"
                      onClick={() => focusThreadMessage(message)}
                    >
                      <div className="truncate text-xs font-medium text-white">
                        {message.senderUserID}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-300/82">
                        {getMessagePreview(message) || "Pinned message"}
                      </div>
                    </button>
                  ))}
                  {!pinnedMessages.length && (
                    <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-black/10 px-3 py-3 text-xs text-slate-300/82">
                      Pin important messages from the message action menu.
                    </div>
                  )}
                </div>
              </div>
            )}

            {active?.type === ZIMConversationType.Group && (
              <div className="space-y-3">
                <div className="premium-card rounded-[1.45rem] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      {activeGroupInfo?.groupAvatarUrl ? (
                        <img
                          src={activeGroupInfo.groupAvatarUrl}
                          alt={activeGroupInfo?.groupName || active.title}
                          className="h-12 w-12 shrink-0 rounded-2xl border border-white/10 object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 via-sky-400 to-indigo-500 text-lg font-semibold text-slate-950">
                          {(activeGroupInfo?.groupName || active.title || "G")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/65">
                        Group summary
                      </div>
                      <div className="mt-2 text-base font-semibold text-white">
                        {activeGroupInfo?.groupName || active.title}
                      </div>
                      <div className="mt-1 break-all text-xs text-slate-300/82">
                        ID: {activeGroupInfo?.groupID || active.id}
                      </div>
                    </div>
                    </div>
                    <span className="rounded-full bg-cyan-400/15 px-2.5 py-1 text-[11px] font-medium text-cyan-50">
                      {activeGroupMemberCount || 0} members
                    </span>
                  </div>
                  {activeGroupInfo?.groupNotice ? (
                    <div className="mt-3 rounded-[1.2rem] border border-white/10 bg-black/15 px-3 py-2 text-xs text-slate-200/82">
                      {activeGroupInfo.groupNotice}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-white">
                      {isCurrentGroupOwner
                        ? "Owner"
                        : isCurrentGroupAdmin
                          ? "Admin"
                          : "Member"}
                    </span>
                    {activeGroupInfo?.ownerUserID ? (
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-slate-200/82">
                        Owner: {activeGroupInfo.ownerUserID}
                      </span>
                    ) : null}
                  </div>
                </div>

                {isCurrentGroupOwner && (
                  <div className="premium-card space-y-3 rounded-[1.45rem] p-3">
                    <div className="text-sm font-semibold text-white">
                      Edit group
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs text-slate-300/82">Group name</div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          value={groupNameInput}
                          onChange={(e) => setGroupNameInput(e.target.value)}
                          placeholder="Enter group name"
                          className="flex-1 rounded-xl border border-white/10 bg-black/18 px-3 py-2 text-xs text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
                        />
                        <button
                          type="button"
                          className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white transition hover:bg-white/14"
                          onClick={() => handleUpdateGroupName(active.id)}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs text-slate-300/82">Group notice</div>
                      <textarea
                        value={groupNoticeInput}
                        onChange={(e) => setGroupNoticeInput(e.target.value)}
                        rows={3}
                        placeholder="Share a short group description or notice"
                        className="w-full rounded-xl border border-white/10 bg-black/18 px-3 py-2 text-xs text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
                      />
                      <button
                        type="button"
                        className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white transition hover:bg-white/14"
                        onClick={() => handleUpdateGroupNotice(active.id)}
                      >
                        Update notice
                      </button>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs text-slate-300/82">Avatar URL</div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          value={groupAvatarInput}
                          onChange={(e) => setGroupAvatarInput(e.target.value)}
                          placeholder="https://..."
                          className="flex-1 rounded-xl border border-white/10 bg-black/18 px-3 py-2 text-xs text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
                        />
                        <button
                          type="button"
                          className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white transition hover:bg-white/14"
                          onClick={() => handleUpdateGroupAvatar(active.id)}
                        >
                          Update
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="premium-card rounded-[1.45rem] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold text-white">
                      Group members
                    </div>
                    {isCurrentGroupAdmin && (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-100">
                        Admin controls
                      </span>
                    )}
                  </div>
                  <div className="soft-scrollbar max-h-52 space-y-1.5 overflow-y-auto pr-1">
                    {activeGroupMembers.map((m) => (
                      (() => {
                        const memberUserID = m?.userID || m?.memberID || "";
                        const memberRole = getGroupMemberRole(m);
                        const isSelfMember = memberUserID.toLowerCase() === userID;
                        const canKickMember =
                          isCurrentGroupAdmin &&
                          !isSelfMember &&
                          memberRole !== GROUP_ROLE.Owner &&
                          (isCurrentGroupOwner || memberRole !== GROUP_ROLE.Admin);
                        const canPromoteToAdmin =
                          isCurrentGroupOwner &&
                          !isSelfMember &&
                          memberRole === GROUP_ROLE.Member;
                        const canDemoteAdmin =
                          isCurrentGroupOwner &&
                          !isSelfMember &&
                          memberRole === GROUP_ROLE.Admin;

                        return (
                          <div
                            key={memberUserID || Math.random()}
                            className="rounded-[1.2rem] border border-white/10 bg-black/10 px-3 py-2 text-xs text-slate-200/82"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate font-medium text-white">
                                  {m?.userName || m?.memberNickname || memberUserID || "member"}
                                </div>
                                <div className="truncate text-[11px] text-slate-300/82">
                                  {memberUserID}
                                </div>
                              </div>
                              <span
                                className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                                  memberRole === GROUP_ROLE.Owner
                                    ? "bg-amber-500/20 text-amber-100"
                                    : memberRole === GROUP_ROLE.Admin
                                      ? "bg-cyan-400/20 text-cyan-100"
                                      : "bg-white/10 text-slate-200/82"
                                }`}
                              >
                                {getGroupRoleLabel(memberRole)}
                              </span>
                            </div>
                            {(canKickMember || canPromoteToAdmin || canDemoteAdmin) && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {canPromoteToAdmin && (
                                  <button
                                    type="button"
                                    className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-medium text-cyan-50 transition hover:bg-cyan-400/15"
                                    onClick={() =>
                                      handleSetMemberRole(
                                        active.id,
                                        memberUserID,
                                        GROUP_ROLE.Admin,
                                      )
                                    }
                                  >
                                    Make admin
                                  </button>
                                )}
                                {canDemoteAdmin && (
                                  <button
                                    type="button"
                                    className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white transition hover:bg-white/15"
                                    onClick={() =>
                                      handleSetMemberRole(
                                        active.id,
                                        memberUserID,
                                        GROUP_ROLE.Member,
                                      )
                                    }
                                  >
                                    Remove admin
                                  </button>
                                )}
                                {canKickMember && (
                                  <button
                                    type="button"
                                    className="rounded-full border border-red-400/25 bg-red-500/10 px-2.5 py-1 text-[10px] font-medium text-red-100 transition hover:bg-red-500/15"
                                    onClick={() =>
                                      removeMembersFromGroupFlow(active.id, [memberUserID])
                                    }
                                  >
                                    Remove member
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ))}
                    {!activeGroupMembers.length && (
                      <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-black/10 px-3 py-4 text-center text-xs text-slate-300/82">
                        Group members will appear here after the list syncs.
                      </div>
                    )}
                  </div>
                </div>

                {isCurrentGroupAdmin && (
                  <div className="premium-card space-y-3 rounded-[1.45rem] p-3">
                    <div className="text-sm font-semibold text-white">
                      Manage members
                    </div>
                    <div className="text-xs text-slate-300/82">Add members</div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={groupInviteInput}
                        onChange={(e) => setGroupInviteInput(e.target.value)}
                        placeholder="email/userIDs, comma separated"
                        className="flex-1 rounded-xl border border-white/10 bg-black/18 px-3 py-2 text-xs text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
                      />
                      <button
                        type="button"
                        className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white transition hover:bg-white/14"
                        onClick={() => {
                          addMembersToGroupFlow(active.id, groupInviteInput.split(","));
                          setGroupInviteInput("");
                        }}
                      >
                        Add
                      </button>
                    </div>
                    <div className="text-xs text-slate-300/82">Remove members</div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={groupRemoveInput}
                        onChange={(e) => setGroupRemoveInput(e.target.value)}
                        placeholder="email/userIDs, comma separated"
                        className="flex-1 rounded-xl border border-white/10 bg-black/18 px-3 py-2 text-xs text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
                      />
                      <button
                        type="button"
                        className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white transition hover:bg-white/14"
                        onClick={() => {
                          removeMembersFromGroupFlow(active.id, groupRemoveInput.split(","));
                          setGroupRemoveInput("");
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}

                {isCurrentGroupOwner && (
                  <div className="premium-card space-y-3 rounded-[1.45rem] p-3">
                    <div className="text-sm font-semibold text-white">
                      Ownership
                    </div>
                    <div className="text-xs text-slate-300/82">
                      Transfer ownership before leaving if you want another member to manage the group.
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={groupTransferOwnerInput}
                        onChange={(e) => setGroupTransferOwnerInput(e.target.value)}
                        placeholder="new owner email/userID"
                        className="flex-1 rounded-xl border border-white/10 bg-black/18 px-3 py-2 text-xs text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
                      />
                      <button
                        type="button"
                        className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white transition hover:bg-white/14"
                        onClick={() => handleTransferGroupOwner(active.id)}
                      >
                        Transfer
                      </button>
                    </div>
                  </div>
                )}

                <div className="premium-card rounded-[1.45rem] p-3">
                  <div className="text-sm font-semibold text-white">Group actions</div>
                  <div className="mt-1 text-xs text-slate-300/82">
                    Leave the group from this device. Owners may need to transfer ownership first depending on Zego group rules.
                  </div>
                  <button
                    type="button"
                    className="mt-3 w-full rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-100 transition hover:bg-red-500/15"
                    onClick={() => handleLeaveGroup(active.id)}
                  >
                    Leave group
                  </button>
                  {isCurrentGroupOwner && (
                    <>
                      <div className="mt-3 text-xs text-slate-300/82">
                        Dismiss permanently closes the group for everyone.
                      </div>
                      <button
                        type="button"
                        className="mt-2 w-full rounded-xl border border-red-500/35 bg-red-600/15 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-600/20"
                        onClick={() => handleDismissGroup(active.id)}
                      >
                        Dismiss group
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
            <div className="rounded-[1.2rem] border border-dashed border-white/10 bg-black/10 px-3 py-3 text-xs text-slate-300/82">
              Tip: Long-press or click a message to react, reply, forward, or delete.
            </div>
          </div>
        }
      />
      <IncomingToastStack
        toasts={toasts}
        onOpen={(toast) => {
          openConversationFromToast(toast).catch(() => {});
        }}
        onDismiss={dismissToast}
      />
      {showProfile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="max-w-lg w-full">
            <ProfilePanel
            profile={profile}
            onSave={updateProfile}
            onClose={() => setShowProfile(false)}
          />
        </div>
        </div>
      )}
    </>
  );
}
