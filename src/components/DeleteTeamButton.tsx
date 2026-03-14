"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteTeamButtonProps {
  userId: string;
  teamName: string;
}

export default function DeleteTeamButton({ userId, teamName }: DeleteTeamButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    if (!window.confirm(`Ștergi echipa „${teamName}”? Utilizatorul nu va mai putea accesa aplicația.`)) {
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/teams/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      alert(data.error || "Eroare la ștergere.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50 ml-1"
      title="Șterge echipa"
    >
      {loading ? "..." : "Șterge"}
    </button>
  );
}
