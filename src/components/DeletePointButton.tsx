"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface DeletePointButtonProps {
  pointId: string;
  onDeleted?: () => void;
}

export default function DeletePointButton({ pointId, onDeleted }: DeletePointButtonProps) {
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function handleDelete() {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("drill_points").delete().eq("id", pointId);
    setLoading(false);
    setConfirm(false);
    if (!error) onDeleted?.();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className={`text-sm px-2 py-1 rounded ${
        confirm
          ? "bg-red-600 text-white hover:bg-red-700"
          : "text-red-600 hover:bg-red-50"
      }`}
    >
      {loading ? "..." : confirm ? "Confirmă ștergere" : "Șterge"}
    </button>
  );
}
