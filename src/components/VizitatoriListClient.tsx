"use client";

import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/I18nProvider";

export default function VizitatoriListClient({
  projects,
}: {
  projects: { id: string; name: string }[];
}) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-end mb-3">
          <LanguageSwitcher />
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">{t("visitors.title")}</h1>
        <p className="text-sm text-slate-600 mb-6">{t("visitors.pick")}</p>
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/vizitatori/${p.id}`}
                className="block px-4 py-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
              >
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
        {projects.length === 0 && (
          <p className="text-slate-500 text-sm">{t("visitors.empty")}</p>
        )}
      </div>
    </div>
  );
}
