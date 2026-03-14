"use client";

import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="text-sm text-slate-600 hover:text-slate-800 flex items-center gap-1"
    >
      ← Înapoi
    </button>
  );
}
