"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Sample } from "@/lib/types";
import {
  addPendingDrillPointFields,
  getPendingFormOps,
  applyPendingFormOpsToRecords,
} from "@/lib/offline-store";

interface NivelApaSectionProps {
  drillPointId: string;
  waterDuring: string | null;
  waterAfter24h: string | null;
  /** Adâncimea finală a forajului (m). Dacă setată, interzice valori > aceasta. */
  finalDepth?: number | null;
  refreshKey?: number;
  initialData?: { samples: Sample[] };
  isOffline?: boolean;
}

export default function NivelApaSection({
  drillPointId,
  waterDuring,
  waterAfter24h,
  finalDepth,
  refreshKey = 0,
  initialData,
  isOffline = false,
}: NivelApaSectionProps) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [apaSamples, setApaSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(!isOffline);
  const [form, setForm] = useState({
    water_during: waterDuring ?? "",
    water_after_24h: waterAfter24h ?? "",
  });
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    setForm({
      water_during: waterDuring ?? "",
      water_after_24h: waterAfter24h ?? "",
    });
  }, [waterDuring, waterAfter24h]);

  useEffect(() => {
    if (isOffline) {
      (async () => {
        const baseSamples = (initialData?.samples ?? []).filter((s) => s.type === "APA").sort((a, b) => a.depth_m - b.depth_m);
        const pending = await getPendingFormOps(drillPointId);
        const merged = applyPendingFormOpsToRecords(baseSamples, pending, "samples") as Sample[];
        setApaSamples(merged.filter((s) => s.type === "APA").sort((a, b) => a.depth_m - b.depth_m));
        setLoading(false);
      })();
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from("samples")
        .select("*")
        .eq("drill_point_id", drillPointId)
        .eq("type", "APA")
        .order("depth_m", { ascending: true });
      setApaSamples((data as Sample[]) ?? []);
      setLoading(false);
    };
    load();
  }, [drillPointId, refreshKey, initialData, isOffline]);

  async function handleSave() {
    setMessage(null);
    if (finalDepth != null) {
      const duringM = parseFloat(String(form.water_during).replace(",", "."));
      const afterM = parseFloat(String(form.water_after_24h).replace(",", "."));
      if (!isNaN(duringM) && duringM > finalDepth) {
        setMessage({
          type: "error",
          text: `„În timpul forajului” depășește forajul (max. ${finalDepth} m).`,
        });
        return;
      }
      if (!isNaN(afterM) && afterM > finalDepth) {
        setMessage({
          type: "error",
          text: `„După 24h” depășește forajul (max. ${finalDepth} m).`,
        });
        return;
      }
    }
    setSaving(true);
    const fields = {
      water_during: form.water_during.trim() || null,
      water_after_24h: form.water_after_24h.trim() || null,
    };
    if (isOffline) {
      await addPendingDrillPointFields(drillPointId, fields);
      setMessage({ type: "success", text: "Nivel apă salvat local. Se va sincroniza la revenirea online." });
      setTimeout(() => setMessage(null), 3000);
    } else {
      const { error } = await supabase
        .from("drill_points")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", drillPointId);
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({ type: "success", text: "Nivel apă salvat." });
        setTimeout(() => setMessage(null), 3000);
        router.refresh();
      }
    }
    setSaving(false);
  }

  return (
    <section className="bg-white rounded-lg border shadow-sm p-4">
      <h2 className="font-semibold text-slate-800 mb-4">Nivel Apă</h2>
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === "error"
              ? "bg-red-50 text-red-800 border border-red-200"
              : "bg-green-50 text-green-800 border border-green-200"
          }`}
        >
          {message.text}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            În timpul forajului (m)
          </label>
          <input
            type="text"
            value={form.water_during}
            onChange={(e) => setForm((f) => ({ ...f, water_during: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="ex: 2.5"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            După 24h (m)
          </label>
          <input
            type="text"
            value={form.water_after_24h}
            onChange={(e) => setForm((f) => ({ ...f, water_after_24h: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="ex: 3.0"
          />
        </div>
      </div>
      <div className="mt-4 mb-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Se salvează..." : "Salvează"}
        </button>
      </div>

      {/* Lista probe APA */}
      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-2">Lista APA</h3>
        {loading ? (
          <p className="text-sm text-slate-500 py-4">Se încarcă...</p>
        ) : apaSamples.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">
            Nicio probă APA adăugată. Adaugă o probă de tip APA în secțiunea Probe mai sus.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2">Adâncime (m)</th>
                  <th className="text-left py-2 px-2">Valori / Observații</th>
                </tr>
              </thead>
              <tbody>
                {apaSamples.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="py-2 px-2">{s.depth_m}</td>
                    <td className="py-2 px-2">{s.spt_values || s.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
