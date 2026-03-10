import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { fetchZegoToken } from "./zego/token";
import {
  createZim,
  enterRoomZim,
  getZim,
  leaveRoomZim,
  loginZim,
  logoutZim,
  createGroupZim,
  inviteToGroupZim,
  removeFromGroupZim,
  queryGroupMembersZim,
  joinGroupZim,
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

  useEffect(() => {
    activeRef.current = active;
    setTypingStatus(null);
  }, [active]);

  const conversationsRef = useRef([]);
  const toastTimersRef = useRef(new Map());

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    const users = [...(searchResults || []), ...(groupSearchResults || [])];
    if (!users.length) return;

    setPresenceByUserID((prev) => {
      const next = { ...prev };
      for (const user of users) {
        const id = toZegoUserID(user?.userID || user?.userId || user?.email || "");
        if (!id) continue;
        next[id] = {
          presence: user?.presence || "unknown",
          lastSeen: user?.lastSeen || 0,
          name: user?.name || user?.email || id,
        };
      }
      return next;
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

  const markConversationAsRead = async (conversation) => {
    if (!conversation) return;
    try {
      const zim = getZim();
      await zim.sendConversationMessageReceiptRead(
        conversation.id,
        conversation.type,
      );
    } catch {
      // ignore
    }
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversation.id && c.type === conversation.type
          ? { ...c, unreadCount: 0 }
          : c,
      ),
    );
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
    } catch (e) {
      console.warn("Failed to load group members", e);
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
      await loadGroupMembers(conversation.id);
    }
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
      (m) => m.type === 200 && m.subType === 1 && m.message === "typing",
    );
    if (typingMsg) {
      const isActive =
        activeRef.current?.id === fromConversationID &&
        activeRef.current?.type === type;
      setTypingStatus({
        id: fromConversationID,
        type,
        label: "typing...",
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
            for (const info of infos ?? []) {
              const key = convKey(info.conversationType, info.conversationID);
              next[key] = (next[key] ?? []).map((m) =>
                m.messageID === info.messageID
                  ? { ...m, receiptStatus: info.receiptStatus }
                  : m,
              );
            }
            return next;
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

  useEffect(() => {
    // Mark messages as read when viewing a conversation to drive double-tick receipts.
    markActiveAsRead();
  }, [active, messagesByConv]);

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

  const createGroup = async ({ name, members }) => {
    const cleanName = (name || "").trim();
    if (!cleanName) return;
    if (!isConnected) {
      setStatus({ phase: "error", error: "Connect first, then create a group" });
      return;
    }
    try {
      const allIds = Array.from(
        new Set(
          (members || [])
            .map(toZegoUserID)
            .filter(Boolean)
            .concat(userID),
        ),
      );
      const invitees = allIds.filter((id) => id !== userID);
      
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
    } catch {
      // ignore
    }
    setConversations((prev) =>
      prev.map((c) =>
        c.id === active.id && c.type === active.type ? { ...c, unreadCount: 0 } : c,
      ),
    );
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

  const addMembersToGroup = async (groupID, entries) => {
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

  const removeMembersFromGroup = async (groupID, entries) => {
    if (!groupID) return;
    const ids = (entries || []).map(toZegoUserID).filter(Boolean);
    if (!ids.length) return;
    try {
      await removeFromGroupZim({ groupID, userIDs: ids });
      await loadGroupMembers(groupID);
    } catch (e) {
      setStatus({ phase: "error", error: e?.message || "Remove members failed" });
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
    if (!active || active.type !== ZIMConversationType.Peer) return;
    if (typingTimeoutRef.current) return;
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2500);

    try {
      const { ZIMMessageType, ZIMMessagePriority } = await getZimSdk();
      const zim = getZim();
      const typingMessage = {
        type: ZIMMessageType.Custom,
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
    setGroupAdmins({});
    setSearchResults([]);
    setSearchError("");
    setGroupSearchResults([]);
    setGroupSearchError("");
    setTypingStatus(null);
    setReplyTo(null);
    setCachedIdToken(null);
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
          onCreateGroup={createGroup}
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
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-white">
                <div className="font-semibold">Chat setup error</div>
                <div className="text-red-200 mt-2 break-words">{status.error}</div>
                <div className="text-purple-200 mt-3 text-sm">
                  Check `frontend/.env` and backend `/api/token`.
                </div>
              </div>
            </div>
          ) : !active ? (
            <div className="flex h-full items-center justify-center px-6">
              <div className="max-w-md rounded-[1.9rem] border border-dashed border-white/15 bg-white/[0.05] px-6 py-8 text-center">
                <div className="text-[11px] uppercase tracking-[0.26em] text-cyan-100/65">
                  No chat selected
                </div>
                <div className="mt-3 text-xl font-semibold text-white">
                  Pick a conversation or start a fresh one.
                </div>
                <div className="mt-3 text-sm text-purple-200">
                  Search for a teammate, create a group, or open the sidebar from the hamburger menu on mobile.
                </div>
              </div>
            </div>
          ) : (
            <>
              <MessageList
                messages={messagesByConv[convKey(active.type, active.id)] ?? []}
                selfUserID={userID}
                onReact={handleReact}
                onReply={handleReply}
                onForward={handleForward}
                onDeleteForMe={handleDeleteForMe}
                onDeleteForAll={handleDeleteForAll}
              />
              <div className="px-6 text-purple-200 text-sm">
                {typingStatus && active?.type === ZIMConversationType.Peer
                  ? `${active.title} is typing...`
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
          <div className="w-full h-full rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl p-4 text-sm text-purple-100 space-y-4">
            <div className="font-semibold mb-1">Info</div>
            <div className="text-xs text-purple-200">
              Signed in as <span className="font-semibold text-white">{user?.email || userID}</span>
            </div>
            <div className="text-xs text-purple-200">
              Current room: <span className="font-semibold text-white">{appRoomID}</span>
            </div>
            <div className="text-xs text-purple-200">
              Status: <span className="font-semibold text-white">{subtitle}</span>
            </div>
            {active?.type === ZIMConversationType.Group && (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-white flex items-center justify-between">
                  Group members
                  {groupAdmins[active.id] === userID && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-100">
                      Admin
                    </span>
                  )}
                </div>
                <div className="max-h-40 overflow-auto space-y-1 pr-1">
                  {(groupMembers[active.id] || []).map((m) => (
                    <div
                      key={m?.userID || m?.memberID || Math.random()}
                      className="text-xs text-purple-100 bg-white/5 rounded-lg px-2 py-1 flex items-center justify-between"
                    >
                      <span className="truncate">{m?.userID || m?.memberID || "member"}</span>
                      {m?.role === 1 && (
                        <span className="text-[10px] text-amber-200 ml-2">Owner</span>
                      )}
                    </div>
                  ))}
                </div>
                {groupAdmins[active.id] === userID && (
                  <div className="space-y-2">
                    <div className="text-xs text-purple-200">Add members</div>
                    <div className="flex gap-2">
                      <input
                        value={groupInviteInput}
                        onChange={(e) => setGroupInviteInput(e.target.value)}
                        placeholder="email/userIDs, comma separated"
                        className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400/60"
                      />
                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-xs hover:bg-white/15 transition"
                        onClick={() => {
                          addMembersToGroup(active.id, groupInviteInput.split(","));
                          setGroupInviteInput("");
                        }}
                      >
                        Add
                      </button>
                    </div>
                    <div className="text-xs text-purple-200">Remove members</div>
                    <div className="flex gap-2">
                      <input
                        value={groupRemoveInput}
                        onChange={(e) => setGroupRemoveInput(e.target.value)}
                        placeholder="email/userIDs, comma separated"
                        className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400/60"
                      />
                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-xs hover:bg-white/15 transition"
                        onClick={() => {
                          removeMembersFromGroup(active.id, groupRemoveInput.split(","));
                          setGroupRemoveInput("");
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="text-xs text-purple-200">
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
