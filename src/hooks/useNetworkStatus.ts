"use client";

import { useState, useEffect, useCallback } from "react";
import { subscribe as subscribeOfflineStatus, isOnline as getOfflineStatus } from "@/lib/offline/offlineStatus";
import { getPendingCount, processQueueWithRetry } from "@/lib/offline/syncQueue";

export interface NetworkStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncResult: { synced: number; failed: number } | null;
}

/**
 * Hook pentru starea rețelei (offlineStatus) și coada de sync.
 * La revenirea online, sync-ul rulează din offlineStatus; aici expunem pendingCount și runSync manual.
 */
export function useNetworkStatus(onAfterSync?: () => void): NetworkStatus {
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ synced: number; failed: number } | null>(null);

  const refreshPendingCount = useCallback(async () => {
    const n = await getPendingCount();
    setPendingCount(n);
  }, []);

  const runSync = useCallback(async () => {
    if (!getOfflineStatus()) return;
    const count = await getPendingCount();
    if (count === 0) return;
    setIsSyncing(true);
    try {
      const result = await processQueueWithRetry();
      if (result) {
        const synced = result.map.synced + result.form.drillPointFields + result.form.formOps + result.form.photos;
        const failed = result.map.failed + result.form.failed;
        setLastSyncResult({ synced, failed });
      }
      await refreshPendingCount();
      onAfterSync?.();
    } finally {
      setIsSyncing(false);
    }
  }, [onAfterSync, refreshPendingCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(getOfflineStatus());
    const unsub = subscribeOfflineStatus((isOn) => {
      setOnline(isOn);
      if (isOn) refreshPendingCount();
    });
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 8000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [refreshPendingCount]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisible = () => {
      if (document.visibilityState === "visible" && getOfflineStatus()) {
        refreshPendingCount();
        runSync();
      }
    };
    document.addEventListener("visibilitychange", handleVisible);
    return () => document.removeEventListener("visibilitychange", handleVisible);
  }, [refreshPendingCount, runSync]);

  return {
    isOnline: online,
    pendingCount,
    isSyncing,
    lastSyncResult,
  };
}
