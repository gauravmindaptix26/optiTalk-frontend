import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ensureProfileInitialized,
  loadProfile,
  saveProfile,
} from "./profileStorage";

const PROFILE_EVENT = "profile:changed";

export function useProfile({ userKey, email, defaultName, defaultPhoto }) {
  const stableKey = useMemo(() => String(userKey ?? ""), [userKey]);
  const [profile, setProfile] = useState(() => {
    if (!stableKey) return null;
    return ensureProfileInitialized({
      userKey: stableKey,
      email,
      defaultName,
      defaultPhoto,
    });
  });

  useEffect(() => {
    let cancelled = false;

    const syncProfile = () => {
      if (cancelled) return;
      if (!stableKey) {
        setProfile(null);
        return;
      }

      setProfile(
        ensureProfileInitialized({
          userKey: stableKey,
          email,
          defaultName,
          defaultPhoto,
        }),
      );
    };

    if (!stableKey) {
      queueMicrotask(syncProfile);
      return;
    }

    queueMicrotask(syncProfile);

    if (typeof window === "undefined") {
      return () => {
        cancelled = true;
      };
    }

    const storageKey = `profile:v1:${stableKey}`;
    const syncStoredProfile = () => {
      setProfile(loadProfile(stableKey));
    };

    const onStorage = (e) => {
      if (e.key !== storageKey) return;
      syncStoredProfile();
    };

    const onLocalChange = (e) => {
      if (e.detail?.key !== stableKey) return;
      syncStoredProfile();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(PROFILE_EVENT, onLocalChange);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PROFILE_EVENT, onLocalChange);
    };
  }, [defaultName, defaultPhoto, email, stableKey]);

  const updateProfile = useCallback(
    (next) => {
      if (!stableKey) return;
      const saved = saveProfile(stableKey, next);
      setProfile(saved);
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
