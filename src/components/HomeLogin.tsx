"use client";

import LoginForm from "@/components/LoginForm";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/I18nProvider";

export default function HomeLogin() {
  const { t } = useI18n();
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-slate-100 to-slate-200">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-3">
          <LanguageSwitcher />
        </div>
        <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">{t("app.name")}</h1>
        <p className="text-center text-slate-600 mb-6 text-sm">{t("app.subtitle")}</p>
        <LoginForm />
      </div>
    </main>
  );
}
