"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface DeleteProjectButtonProps {
  projectId: string;
  projectName: string;
  pointsCount?: number;
  onDeleted?: () => void;
}

export default function DeleteProjectButton({
  projectId,
  projectName,
  pointsCount = 0,
  onDeleted,
}: DeleteProjectButtonProps) {
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    setLoading(false);
    setConfirm(false);
    if (!error) {
      if (onDeleted) {
        onDeleted();
      } else {
        router.refresh();
      }
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      title={
        pointsCount > 0
          ? `Șterge proiectul și cele ${pointsCount} puncte de foraj`
          : "Șterge proiectul"
      }
      className={`text-sm px-2 py-1 rounded ${
        confirm
          ? "bg-red-600 text-white hover:bg-red-700"
          : "text-red-600 hover:bg-red-50"
      } disabled:opacity-50`}
    >
      {loading ? "..." : confirm ? "Confirmă ștergere" : "Șterge"}
    </button>
  );
}
