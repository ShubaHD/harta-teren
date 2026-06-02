"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ResetPointStatusButtonProps {
  pointId: string;
  pointCode: string;
  onReset?: () => void;
}

/** Resetează punctul la status „De făcut” – doar pentru admin. */
export default function ResetPointStatusButton({
  pointId,
  pointCode,
  onReset,
}: ResetPointStatusButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!window.confirm(`Resetezi punctul „${pointCode}” la „De făcut”? Echipă, date început/finalizare vor fi șterse.`)) {
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("drill_points")
      .update({
        status: "de_facut",
        assigned_team: null,
        started_at: null,
        completed_at: null,
        completed_by: null,
        final_depth: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pointId);
    setLoading(false);
    if (!error) onReset?.();
  }

  return (
    <button
      type="button"
      onClick={handleReset}
      disabled={loading}
      className="text-sm px-2 py-1 rounded text-blue-600 hover:bg-blue-50 disabled:opacity-50"
      title="Resetează la De făcut"
    >
      {loading ? "..." : "Resetează"}
    </button>
  );
}
