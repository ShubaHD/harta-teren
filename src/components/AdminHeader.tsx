"use client";

import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import { useI18n } from "./I18nProvider";

export default function AdminHeader() {
  const { t } = useI18n();
  return (
    <header className="flex items-center justify-between px-4 py-2 bg-white border-b shrink-0 gap-2">
      <nav className="flex items-center gap-4 flex-wrap min-w-0">
        <Link href="/admin" className="font-semibold text-slate-800">
          {t("nav.admin")}
        </Link>
        <Link href="/admin/proiecte" className="text-sm text-slate-600 hover:text-blue-600">
          {t("nav.projects")}
        </Link>
        <Link href="/admin/echipe" className="text-sm text-slate-600 hover:text-blue-600">
          {t("nav.teams")}
        </Link>
        <Link href="/mapa" className="text-sm text-slate-600 hover:text-blue-600">
          {t("nav.map")}
        </Link>
        <Link href="/vizitatori" target="_blank" className="text-sm text-slate-600 hover:text-blue-600">
          {t("nav.visitors")}
        </Link>
        <Link href="/export" className="text-sm text-slate-600 hover:text-blue-600">
          {t("nav.export")}
        </Link>
        <a
          href="/api/admin/backup"
          download
          className="text-sm text-slate-600 hover:text-blue-600"
        >
          {t("nav.backup")}
        </a>
      </nav>
      <div className="flex items-center gap-2 shrink-0">
        <LanguageSwitcher />
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-sm text-slate-600 hover:text-slate-800 min-h-[32px]">
            {t("nav.logout")}
          </button>
        </form>
      </div>
    </header>
  );
}
