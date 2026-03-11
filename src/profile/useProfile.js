import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  ensureProfileInitialized,
  saveProfile,
} from "./profileStorage";

const PROFILE_EVENT = "profile:changed";

export function useProfile({ userKey, email, defaultName, defaultPhoto }) {
  const stableKey = useMemo(() => String(userKey ?? ""), [userKey]);

  const getSnapshot = useCallback(() => {
    if (!stableKey) return null;
    return ensureProfileInitialized({
      userKey: stableKey,
      email,
      defaultName,
      defaultPhoto,
    });
  }, [defaultName, defaultPhoto, email, stableKey]);

  const subscribe = useCallback(
    (onStoreChange) => {
      if (typeof window === "undefined" || !stableKey) {
        return () => {};
      }

      const storageKey = `profile:v1:${stableKey}`;
      const onStorage = (e) => {
        if (e.key !== storageKey) return;
        onStoreChange();
      };
      const onLocalChange = (e) => {
        if (e.detail?.key !== stableKey) return;
        onStoreChange();
      };

      window.addEventListener("storage", onStorage);
      window.addEventListener(PROFILE_EVENT, onLocalChange);

      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(PROFILE_EVENT, onLocalChange);
      };
    },
    [stableKey],
  );

  const profile = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const updateProfile = useCallback(
    (next) => {
      if (!stableKey) return;
      saveProfile(stableKey, next);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(PROFILE_EVENT, { detail: { key: stableKey } }),
        );
      }
    },
    [stableKey],
  );

  return { profile, updateProfile };
}
