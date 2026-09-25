"use client";

import { LOCALES } from "@/lib/i18n/types";
import { useI18n } from "./I18nProvider";

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={`inline-flex rounded-lg border border-slate-300 overflow-hidden shrink-0 ${className}`}
      role="group"
      aria-label={t("lang.label")}
    >
      {LOCALES.map(({ id, label }) => {
        const active = locale === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setLocale(id)}
            className={`px-2 py-1 min-h-[32px] text-xs font-semibold touch-manipulation ${
              active ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
