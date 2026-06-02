"use client";

import { useEffect } from "react";
import { start as startOfflineStatus, stop as stopOfflineStatus } from "@/lib/offline/offlineStatus";

/**
 * Starts offline-status (connectivity probe + sync queue on online).
 * Sync is handled by offlineStatus when connectivity returns.
 */
export default function OfflineSyncEffect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    startOfflineStatus();
    return () => stopOfflineStatus();
  }, []);
  return null;
}
