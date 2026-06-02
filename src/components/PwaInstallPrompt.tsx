"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "pwa-install-dismissed";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (window as Window & { standalone?: boolean }).standalone === true
    || window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768 || "ontouchstart" in window;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<{
    prompt: () => Promise<{ outcome: string }>;
  } | null>(null);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsIos(isIOS());
    setStandalone(isStandalone());
    setMobile(isMobile());
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") {
        setDismissed(true);
        return;
      }
    } catch {}

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as unknown as { prompt: () => Promise<{ outcome: string }> });
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const resize = () => setMobile(isMobile());
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Pe iOS nu există beforeinstallprompt – arătăm instrucțiuni doar pe telefon/tabletă, dacă nu e deja instalat
  useEffect(() => {
    if (dismissed || standalone || !mobile) return;
    if (isIos && !deferredPrompt) setShow(true);
  }, [isIos, deferredPrompt, dismissed, standalone, mobile]);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    setShow(false);
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setShow(false);
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
  }

  if (!show || dismissed || standalone) return null;

  // iPhone / iPad: instrucțiuni „Adaugă pe ecranul de start”
  if (isIos) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-[9999] max-w-md mx-auto bg-slate-800 text-white rounded-xl shadow-lg p-4 safe-area-bottom safe-area-left safe-area-right">
        <p className="font-medium text-sm mb-1">Instalează pentru lucru pe teren</p>
        <p className="text-xs text-slate-300 mb-3">
          Apasă <span className="inline-flex items-center gap-0.5">Share <span className="text-base">□↑</span></span> în Safari, apoi „Adaugă pe ecranul de start”. După aceea aplicația funcționează și offline.
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          className="w-full py-2.5 min-h-[44px] rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium touch-manipulation"
        >
          Am înțeles
        </button>
      </div>
    );
  }

  // Android / Chrome: buton Instalare
  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] max-w-md mx-auto bg-slate-800 text-white rounded-xl shadow-lg p-4 flex items-center gap-4 safe-area-bottom safe-area-left safe-area-right">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">Instalează pentru lucru pe teren</p>
        <p className="text-xs text-slate-300 mt-0.5">
          Acces rapid de pe ecranul principal, funcționează offline
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={handleInstall}
          className="px-4 py-2.5 min-h-[44px] inline-flex items-center bg-white text-slate-800 rounded-lg text-sm font-medium touch-manipulation"
        >
          Instalează
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-2 py-2.5 text-slate-400 hover:text-white text-sm touch-manipulation"
          aria-label="Închide"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
