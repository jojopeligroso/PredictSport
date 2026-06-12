"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "chat-last-seen";

// --------------------------------------------------------------------------
// External store for cross-component reactivity (TabBar + MobileNav + page)
// --------------------------------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(cb: Listener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emitChange() {
  for (const cb of listeners) cb();
}

function getLastSeen(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// Hook
// --------------------------------------------------------------------------

/**
 * Shared unread-chat tracking hook.
 *
 * - `unreadCount`: number of unread messages (capped at 99 for display).
 * - `markSeen()`: write current timestamp to localStorage, clearing badge.
 *
 * `latestChatAt` is the ISO timestamp of the most recent chat message
 * (passed down from server data or realtime).
 *
 * `totalSince` is the count of messages since last seen (from server query).
 * If not provided, `unreadCount` is 1 when there's any unseen message, 0 otherwise.
 */
export function useUnreadChat(
  latestChatAt: string | null | undefined,
  totalSince?: number,
) {
  const lastSeen = useSyncExternalStore(subscribe, getLastSeen, () => null);

  const hasUnread =
    !!latestChatAt &&
    (!lastSeen || new Date(latestChatAt) > new Date(lastSeen));

  const unreadCount = hasUnread ? (totalSince ?? 1) : 0;

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      /* SSR / private browsing */
    }
    emitChange();
  }, []);

  // Listen for storage changes from other tabs
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) emitChange();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { unreadCount, hasUnread, markSeen };
}
