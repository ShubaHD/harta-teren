"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "./I18nProvider";

export default function BackButton() {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="text-sm text-slate-600 hover:text-slate-800 flex items-center gap-1 min-h-[44px] py-2 -my-1 touch-manipulation"
    >
      ← {t("nav.back")}
    </button>
  );
}
