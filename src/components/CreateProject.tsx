"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function CreateProject() {
  const [name, setName] = useState("");
  const [beneficiar, setBeneficiar] = useState("");
  const [tema, setTema] = useState("");
  const [locatie, setLocatie] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.from("projects").insert({
      name: name.trim(),
      client: beneficiar.trim() || null,
      topic: tema.trim() || null,
      location: locatie.trim() || null,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setName("");
    setBeneficiar("");
    setTema("");
    setLocatie("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nume proiect *"
        className="px-3 py-1.5 border rounded-lg text-sm"
      />
      <input
        type="text"
        value={beneficiar}
        onChange={(e) => setBeneficiar(e.target.value)}
        placeholder="Beneficiar"
        className="px-3 py-1.5 border rounded-lg text-sm"
      />
      <input
        type="text"
        value={tema}
        onChange={(e) => setTema(e.target.value)}
        placeholder="Tema"
        className="px-3 py-1.5 border rounded-lg text-sm"
      />
      <input
        type="text"
        value={locatie}
        onChange={(e) => setLocatie(e.target.value)}
        placeholder="Locatie"
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
