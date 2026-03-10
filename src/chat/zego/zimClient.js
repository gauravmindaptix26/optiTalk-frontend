import { getZimSdk } from "./zimSdk";

let zimInstance = null;
let createPromise = null;
let loginState = null;
let loggedInUserID = null;

export function getZim() {
  if (!zimInstance) throw new Error("ZIM instance not created yet");
  return zimInstance;
}

export async function createZim() {
  if (zimInstance) return zimInstance;
  if (createPromise) return createPromise;

  createPromise = (async () => {
    const { ZIM } = await getZimSdk();
    const appID = Number(import.meta.env.VITE_ZEGO_APP_ID);
    if (!appID) {
      throw new Error("Missing/invalid VITE_ZEGO_APP_ID in frontend/.env");
    }

    console.log(`[ZIM] Creating ZIM instance with appID=${appID}`);

    // Guard for StrictMode: create only once per tab.
    ZIM.create({ appID });
    zimInstance = ZIM.getInstance();

    zimInstance.off("error");
    zimInstance.off("connectionStateChanged");

    zimInstance.on("error", (_zim, errorInfo) => {
      console.error("[ZIM error]", errorInfo?.code, errorInfo?.message, errorInfo);
    });

    zimInstance.on("connectionStateChanged", (_zim, { state, event }) => {
      console.log("[ZIM connectionStateChanged]", state, event);
    });

    console.log("[ZIM] ZIM instance created successfully");
    return zimInstance;
  })();

  try {
    return await createPromise;
  } finally {
    createPromise = null;
  }
}

export async function loginZim({ userID, userName, token }) {
  if (!zimInstance) await createZim();

  if (typeof userID !== "string") throw new Error("loginZim: userID must be string");
  if (typeof token !== "string") throw new Error("loginZim: token must be string");

  const cleanUserID = userID.trim();
  const cleanUserName = (userName || cleanUserID).toString();

  if (loggedInUserID === cleanUserID) {
    console.log(`[ZIM] Reusing existing login for "${cleanUserID}"`);
    return { ok: true, reused: true };
  }

  if (loginState?.userID === cleanUserID) {
    console.log(`[ZIM] Awaiting in-flight login for "${cleanUserID}"`);
    return loginState.promise;
  }

  if (loggedInUserID && loggedInUserID !== cleanUserID) {
    try {
      console.log(`[ZIM] Logging out previous user "${loggedInUserID}" before switching to "${cleanUserID}"`);
      zimInstance.logout();
    } catch (e) {
      console.warn("logout before login failed", e);
    }
    loggedInUserID = null;
  }

  console.log(
    `[ZIM] loginZim: userID="${cleanUserID}" (length=${cleanUserID.length}), userName="${cleanUserName}"`,
  );

  const pendingLogin = (async () => {
    const userInfo = { userID: cleanUserID, userName: cleanUserName };

    let result;
    try {
      result = await zimInstance.login(userInfo, token);
    } catch (err) {
      const errCode = err?.code ?? err?.errorCode ?? err?.moduleErrCode ?? "";
      const errMsg = err?.message || err?.errorMessage || err?.errorMsg || String(err);
      const detail = errCode ? `code=${errCode} ${errMsg}` : errMsg;
      console.error(`[ZIM] Login threw error for "${cleanUserID}":`, err);
      throw new Error(detail);
    }

    console.log("[ZIM] login returned", result);

    const hasErrorCode = result && (result.errorCode || result.errorCode === 0);
    const hasError = result && (result.error || result.errorMsg || result.errorMessage);

    if (hasErrorCode && result.errorCode !== 0) {
      const errCode = String(result.errorCode);
      const errMsg =
        result.errorMessage ||
        result.errorMsg ||
        result.error?.message ||
        String(result.errorCode);
      console.error(`[ZIM] Login failed: errorCode=${errCode}, message=${errMsg}`);
      throw new Error(`code=${errCode} ${errMsg}`);
    }

    if (hasError) {
      const errMsg = result.error?.message || result.errorMessage || result.errorMsg;
      console.error(`[ZIM] Login failed: ${errMsg}`);
      throw new Error(errMsg);
    }

    loggedInUserID = cleanUserID;
    console.log(`[ZIM] Login successful! User "${cleanUserID}" now connected to Zego`);
    return result || { ok: true };
  })();

  loginState = { userID: cleanUserID, promise: pendingLogin };

  try {
    return await pendingLogin;
  } finally {
    if (loginState?.promise === pendingLogin) {
      loginState = null;
    }
  }
}

export async function enterRoomZim({ roomID, roomName }) {
  if (!zimInstance) throw new Error("enterRoomZim: ZIM instance not created");
  const cleanRoomID = String(roomID ?? "").trim();
  if (!cleanRoomID) throw new Error("enterRoomZim: roomID is required");
  return zimInstance.enterRoom({ roomID: cleanRoomID, roomName: roomName ?? cleanRoomID });
}

export async function leaveRoomZim({ roomID }) {
  if (!zimInstance) return;
  const cleanRoomID = String(roomID ?? "").trim();
  if (!cleanRoomID) return;
  try {
    await zimInstance.leaveRoom(cleanRoomID);
  } catch (e) {
    console.warn("leaveRoomZim failed", e);
  }
}

export function logoutZim() {
  if (!zimInstance) return;
  try {
    zimInstance.logout();
    loggedInUserID = null;
    loginState = null;
  } catch (e) {
    console.warn("logoutZim failed", e);
  }
}

export async function createGroupZim({ groupName, userIDs = [] }) {
  if (!zimInstance) await createZim();
  const info = {
    groupName: (groupName || "").trim(),
    groupAvatarUrl: "",
  };
  const members = (userIDs || []).filter(Boolean);

  console.log(`[ZIM] createGroupZim called with groupName=${info.groupName}, members=${JSON.stringify(members)}`);
  const resp = await zimInstance.createGroup(info, members);
  console.log("[ZIM] createGroup response:", resp);

  const formatErrUser = (u) => {
    if (!u) return "unknown";
    const idRaw = u.userID ?? u.memberID ?? u.id ?? null;
    const id =
      typeof idRaw === "string" ? idRaw : idRaw ? JSON.stringify(idRaw) : JSON.stringify(u);
    const reason =
      u.reason || u.message || u.code || u.errorCode || u.errorMessage || "";

    const codeStr = String(u.code || u.errorCode || "");
    let detail = reason;
    const reasonStr = String(reason || "");
    if (codeStr === "6000001" || reasonStr.includes("6000001")) {
      detail = "User doesn't exist in Zego (they need to login first)";
    }

    return detail ? `${id} (${detail})` : id;
  };

  const groupID =
    resp?.groupID ||
    resp?.groupInfo?.baseInfo?.groupID ||
    resp?.groupInfo?.groupID ||
    resp?.createdGroupInfo?.groupID ||
    resp?.createdGroupID ||
    resp?.data?.groupID ||
    resp?.data?.groupInfo?.groupID ||
    resp?.data?.createdGroupID ||
    null;

  if (!groupID) {
    console.error("[ZIM] createGroup response missing groupID. Response:", resp);
    const errored =
      (resp?.errorUserList || [])
        .map(formatErrUser)
        .filter(Boolean);
    if (errored.length) {
      throw new Error(`Could not add members: ${errored.join(", ")}`);
    }

    const respKeys = Object.keys(resp || {}).join(",");
    console.error("[ZIM] Full response object:", JSON.stringify(resp, null, 2));
    throw new Error(
      `Group creation failed - missing groupID. Response keys: ${respKeys}. Check console logs.`,
    );
  }

  return {
    ...resp,
    groupID,
    groupInfo: resp?.groupInfo || { groupID, groupName: info.groupName },
  };
}

export async function inviteToGroupZim({ groupID, userIDs = [] }) {
  if (!zimInstance) await createZim();
  const members = (userIDs || []).filter(Boolean);
  console.log(`[ZIM] inviteToGroupZim called with groupID=${groupID}, members=${JSON.stringify(members)}`);
  const resp = await zimInstance.inviteUsersIntoGroup(members, groupID);
  console.log("[ZIM] inviteUsersIntoGroup response:", resp);
  return resp;
}

export async function removeFromGroupZim({ groupID, userIDs = [] }) {
  if (!zimInstance) await createZim();
  const ids = (userIDs || []).filter(Boolean);
  return zimInstance.kickGroupMembers(ids, groupID);
}

export async function joinGroupZim({ groupID }) {
  if (!zimInstance) await createZim();
  const cleanGroupID = String(groupID ?? "").trim();
  if (!cleanGroupID) throw new Error("joinGroupZim: groupID is required");
  try {
    console.log(`[ZIM] Joining group: ${cleanGroupID}`);
    const result = await zimInstance.joinGroup(cleanGroupID);
    console.log(`[ZIM] Joined group ${cleanGroupID}:`, result);
    return result;
  } catch (e) {
    const msg = (e?.message || "").toLowerCase();
    if (msg.includes("already") || msg.includes("exist")) {
      console.log(`[ZIM] Already member of group ${cleanGroupID}`);
      return;
    }
    console.error(`[ZIM] Failed to join group ${cleanGroupID}:`, e);
    throw e;
  }
}

export async function queryGroupMembersZim({ groupID, count = 50 }) {
  if (!zimInstance) await createZim();
  return zimInstance.queryGroupMemberList(groupID, { count, nextFlag: 0 });
}

export async function leaveGroupZim({ groupID }) {
  if (!zimInstance) await createZim();
  const cleanGroupID = String(groupID ?? "").trim();
  if (!cleanGroupID) throw new Error("leaveGroupZim: groupID is required");
  return zimInstance.leaveGroup(cleanGroupID);
}

export async function queryGroupInfoZim({ groupID }) {
  if (!zimInstance) await createZim();
  const cleanGroupID = String(groupID ?? "").trim();
  if (!cleanGroupID) throw new Error("queryGroupInfoZim: groupID is required");
  return zimInstance.queryGroupInfo(cleanGroupID);
}

export async function updateGroupNameZim({ groupID, groupName }) {
  if (!zimInstance) await createZim();
  const cleanGroupID = String(groupID ?? "").trim();
  const cleanGroupName = String(groupName ?? "").trim();
  if (!cleanGroupID) throw new Error("updateGroupNameZim: groupID is required");
  if (!cleanGroupName) throw new Error("updateGroupNameZim: groupName is required");
  return zimInstance.updateGroupName(cleanGroupName, cleanGroupID);
}

export async function updateGroupNoticeZim({ groupID, groupNotice }) {
  if (!zimInstance) await createZim();
  const cleanGroupID = String(groupID ?? "").trim();
  const cleanGroupNotice = String(groupNotice ?? "").trim();
  if (!cleanGroupID) throw new Error("updateGroupNoticeZim: groupID is required");
  return zimInstance.updateGroupNotice(cleanGroupNotice, cleanGroupID);
}

export async function updateGroupAvatarUrlZim({ groupID, groupAvatarUrl }) {
  if (!zimInstance) await createZim();
  const cleanGroupID = String(groupID ?? "").trim();
  const cleanGroupAvatarUrl = String(groupAvatarUrl ?? "").trim();
  if (!cleanGroupID) throw new Error("updateGroupAvatarUrlZim: groupID is required");
  return zimInstance.updateGroupAvatarUrl(cleanGroupAvatarUrl, cleanGroupID);
}

export async function transferGroupOwnerZim({ groupID, toUserID }) {
  if (!zimInstance) await createZim();
  const cleanGroupID = String(groupID ?? "").trim();
  const cleanUserID = String(toUserID ?? "").trim();
  if (!cleanGroupID) throw new Error("transferGroupOwnerZim: groupID is required");
  if (!cleanUserID) throw new Error("transferGroupOwnerZim: toUserID is required");
  return zimInstance.transferGroupOwner(cleanUserID, cleanGroupID);
}

export async function dismissGroupZim({ groupID }) {
  if (!zimInstance) await createZim();
  const cleanGroupID = String(groupID ?? "").trim();
  if (!cleanGroupID) throw new Error("dismissGroupZim: groupID is required");
  return zimInstance.dismissGroup(cleanGroupID);
}

export async function setGroupMemberRoleZim({ groupID, userID, role }) {
  if (!zimInstance) await createZim();
  const cleanGroupID = String(groupID ?? "").trim();
  const cleanUserID = String(userID ?? "").trim();
  const nextRole = Number(role);
  if (!cleanGroupID) throw new Error("setGroupMemberRoleZim: groupID is required");
  if (!cleanUserID) throw new Error("setGroupMemberRoleZim: userID is required");
  if (!nextRole) throw new Error("setGroupMemberRoleZim: role is required");
  return zimInstance.setGroupMemberRole(nextRole, cleanUserID, cleanGroupID);
}
