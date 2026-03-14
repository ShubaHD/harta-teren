"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ResetTeamPasswordButtonProps {
  userId: string;
  teamName: string;
}

export default function ResetTeamPasswordButton({ userId, teamName }: ResetTeamPasswordButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    const newPassword = window.prompt(`Parolă nouă pentru echipa „${teamName}”:`, "");
    if (newPassword == null) return;
    if (newPassword.length < 4) {
      alert("Parola trebuie să aibă cel puțin 4 caractere.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/teams/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      alert("Parola a fost schimbată.");
      router.refresh();
    } else {
      alert(data.error || "Eroare la schimbarea parolei.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="text-xs px-2 py-1 text-amber-700 hover:bg-amber-50 rounded disabled:opacity-50"
      title="Schimbă parola"
    >
      {loading ? "..." : "Parolă"}
    </button>
  );
}
