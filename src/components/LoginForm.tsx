"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveProfileForOffline } from "@/lib/offline-service";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (err) {
      setLoading(false);
      const isNetworkError =
        err.message === "Failed to fetch" ||
        err.message?.toLowerCase().includes("network") ||
        err.message?.toLowerCase().includes("fetch");
      setError(
        isNetworkError
          ? "Nu există conexiune la internet. Conectează-te la rețea și încearcă din nou."
          : err.message
      );
      return;
    }
    const userId = data.user?.id;
    if (userId) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("team_name, role")
          .eq("id", userId)
          .single();
        await saveProfileForOffline({
          userId,
          teamName: profile?.team_name ?? null,
          isAdmin: profile?.role === "admin",
        });
      } catch {
        await saveProfileForOffline({
          userId,
          teamName: null,
          isAdmin: false,
        });
      }
    }
    setLoading(false);
    const role = data.user?.user_metadata?.role as string | undefined;
    const target = role === "admin" ? "/admin" : "/mapa";
    window.location.href = target;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@harta.local sau echipa1@harta.local"
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Parolă
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="••••••••"
          required
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Se încarcă..." : "Intră"}
      </button>
    </form>
  );
}
