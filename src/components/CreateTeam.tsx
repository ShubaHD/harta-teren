"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateTeam() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !password) {
      setError("Nume și parolă obligatorii.");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    const res = await fetch("/api/admin/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Eroare la creare");
      return;
    }
    setSuccess(`Echipă "${name}" creată. Email: ${data.email}`);
    setName("");
    setPassword("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
      <div>
        <label className="block text-xs text-slate-600 mb-1">Nume echipă</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex: Echipa Nord"
          className="px-3 py-1.5 border rounded-lg text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-600 mb-1">Parolă</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="px-3 py-1.5 border rounded-lg text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {loading ? "..." : "Crează echipă"}
      </button>
      {error && <span className="text-red-600 text-sm">{error}</span>}
      {success && <span className="text-green-600 text-sm">{success}</span>}
    </form>
  );
}
