"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { messages } from "@/lib/i18n/messages";
import { LANG_STORAGE_KEY, type Locale } from "@/lib/i18n/types";
import type { ro } from "@/lib/i18n/messages";

type MessageKey = keyof typeof ro;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "ro";
  const v = window.localStorage.getItem(LANG_STORAGE_KEY);
  if (v === "en" || v === "es" || v === "ro") return v;
  return "ro";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ro");

  useEffect(() => {
    setLocaleState(readStoredLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: MessageKey) => messages[locale][key] ?? messages.ro[key] ?? key,
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
