"use client";

import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="text-sm text-slate-600 hover:text-slate-800 flex items-center gap-1 min-h-[44px] py-2 -my-1 touch-manipulation"
    >
      ← Înapoi
    </button>
  );
}
