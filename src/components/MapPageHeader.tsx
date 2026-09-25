"use client";

import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import MapProjectSelector from "./MapProjectSelector";
import { useI18n } from "./I18nProvider";

export default function MapPageHeader({
  projects,
  selectedId,
  isAdmin,
}: {
  projects: { id: string; name: string }[];
  selectedId: string | null;
  isAdmin: boolean;
}) {
  const { t } = useI18n();
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-white border-b shrink-0 min-h-0 safe-area-left safe-area-right">
      <div className="flex items-center gap-2 min-w-0 shrink">
        {isAdmin ? (
          <Link
            href="/admin"
            className="text-sm text-slate-600 hover:text-slate-800 min-h-[44px] inline-flex items-center"
          >
            ← {t("nav.admin")}
          </Link>
        ) : projects.length > 1 ? (
          <Link
            href="/mapa"
            className="text-sm text-slate-600 hover:text-slate-800 min-h-[44px] inline-flex items-center"
          >
            ← {t("nav.back")}
          </Link>
        ) : null}
        <h1 className="font-semibold text-slate-800 text-sm sm:text-base truncate">{t("app.name")}</h1>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <LanguageSwitcher />
        <MapProjectSelector projects={projects} selectedId={selectedId} />
        <Link
          href="/export"
          className="text-xs sm:text-sm text-slate-600 hover:text-blue-600 shrink-0 min-h-[44px] inline-flex items-center"
        >
          {t("nav.export")}
        </Link>
        {isAdmin && (
          <Link
            href="/admin"
            className="text-xs sm:text-sm text-blue-600 hover:underline shrink-0 min-h-[44px] inline-flex items-center"
          >
            {t("nav.admin")}
          </Link>
        )}
        <form action="/auth/signout" method="post" className="shrink-0">
          <button
            type="submit"
            className="text-xs sm:text-sm text-slate-600 hover:text-slate-800 min-h-[44px] px-2 -mx-2 inline-flex items-center touch-manipulation"
          >
            {t("nav.logout")}
          </button>
        </form>
      </div>
    </header>
  );
}
