"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "harta-teren-offline-prep-seen";

export default function OfflinePrepTip() {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    if (!navigator.onLine) return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
      setShow(true);
    } catch {
      setShow(false);
    }
  }, [mounted]);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[1900] bg-slate-800 text-white text-sm px-4 py-3 rounded-lg shadow-lg flex items-start gap-3 safe-area-bottom safe-area-left safe-area-right">
      <span className="flex-1">
        Pe teren fără internet: apasă <strong>„Pregătește offline”</strong> și <strong>„Hartă offline”</strong> când ai rețea. După aceea harta și fișele merg offline.
      </span>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center -m-2 text-slate-300 hover:text-white touch-manipulation"
        aria-label="Închide"
      >
        ×
      </button>
    </div>
  );
}
