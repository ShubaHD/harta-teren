"use client";

import { useState, useEffect } from "react";
import { subscribe as subscribeOfflineStatus } from "@/lib/offline/offlineStatus";
import { getPendingCount } from "@/lib/offline/syncQueue";

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const unsub = subscribeOfflineStatus(setIsOnline);
    getPendingCount().then(setPendingCount);
    const interval = setInterval(() => getPendingCount().then(setPendingCount), 5000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[2000] bg-amber-600 text-white px-4 py-2.5 safe-area-top text-center text-sm font-medium shadow">
      📴 Mod offline – date din cache.
      {pendingCount > 0 && (
        <span className="ml-1 font-semibold">
          {pendingCount} modificări nesincronizate.
        </span>
      )}
      Modificările vor fi sincronizate când revine conexiunea.
    </div>
  );
}
