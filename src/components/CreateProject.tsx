"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function CreateProject() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.from("projects").insert({ name: name.trim() });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setName("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nume proiect"
        className="px-3 py-1.5 border rounded-lg text-sm"
      />
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {loading ? "..." : "Crează"}
      </button>
      {error && <span className="text-red-600 text-sm">{error}</span>}
    </form>
  );
}
