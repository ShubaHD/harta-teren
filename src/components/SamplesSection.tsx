"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Sample } from "@/lib/types";
import { SAMPLE_TYPE_OPTIONS } from "@/lib/types";
import {
  addPendingFormOp,
  getPendingFormOps,
  applyPendingFormOpsToRecords,
} from "@/lib/offline-store";

interface SamplesSectionProps {
  drillPointId: string;
  /** Adâncimea finală a forajului (m). Dacă setată, interzice valori > aceasta. */
  finalDepth?: number | null;
  initialData?: Sample[];
  isOffline?: boolean;
  onSamplesChange?: () => void;
}

const emptyForm = () => ({
  depth_m: "",
  type: "",
  spt_values: "",
  notes: "",
});

export default function SamplesSection({ drillPointId, finalDepth, initialData, isOffline = false, onSamplesChange }: SamplesSectionProps) {
  const supabase = createClient();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(!isOffline);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    if (isOffline) {
      (async () => {
        const base = (initialData ?? []).sort((a, b) => a.depth_m - b.depth_m);
        const pending = await getPendingFormOps(drillPointId);
        const merged = applyPendingFormOpsToRecords(base, pending, "samples") as Sample[];
        setSamples(merged.sort((a, b) => a.depth_m - b.depth_m));
        setLoading(false);
      })();
      return;
    }
    const load = async () => {
      const { data, error } = await supabase
        .from("samples")
        .select("*")
        .eq("drill_point_id", drillPointId)
        .order("depth_m", { ascending: true });
      if (error) {
        console.error("Eroare încărcare probe:", error);
        setMessage({ type: "error", text: `Tabelul probe nu există. Rulează migrarea 009_samples.sql în Supabase: ${error.message}` });
      }
      setSamples((data as Sample[]) ?? []);
      setLoading(false);
    };
    load();
  }, [drillPointId, initialData, isOffline]);

  async function handleSave() {
    setMessage(null);
    const depthM = parseFloat(String(form.depth_m).replace(",", "."));
    if (isNaN(depthM) || depthM < 0) {
      setMessage({ type: "error", text: "Adâncime invalidă (m)" });
      return;
    }
    if (finalDepth != null && depthM > finalDepth) {
      setMessage({
        type: "error",
        text: `Adâncimea depășește forajul (max. ${finalDepth} m). Introdu o valoare ≤ ${finalDepth} m.`,
      });
      return;
    }
    if (!form.type.trim()) {
      setMessage({ type: "error", text: "Selectează tipul probei." });
      return;
    }

    setSaving(true);
    const payload = {
      drill_point_id: drillPointId,
      depth_m: depthM,
      type: form.type.trim(),
      spt_values: form.spt_values.trim() || null,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (isOffline) {
      if (editingId) {
        await addPendingFormOp({
          drillPointId,
          table: "samples",
          action: "update",
          recordId: editingId,
          data: payload,
        });
        setSamples((prev) =>
          prev.map((s) =>
            s.id === editingId ? { ...s, ...payload, id: s.id, created_at: s.created_at || new Date().toISOString() } : s
          ).sort((a, b) => a.depth_m - b.depth_m)
        );
        setEditingId(null);
        setMessage({ type: "success", text: "Probă actualizată local. Se va sincroniza la revenirea online." });
        setTimeout(() => setMessage(null), 3000);
      } else {
        const tempId = crypto.randomUUID();
        await addPendingFormOp({
          drillPointId,
          table: "samples",
          action: "insert",
          recordId: tempId,
          data: payload,
        });
        const newSample = { ...payload, id: tempId, created_at: new Date().toISOString() } as Sample;
        setSamples((prev) => [...prev, newSample].sort((a, b) => a.depth_m - b.depth_m));
        setMessage({ type: "success", text: "Probă adăugată local. Se va sincroniza la revenirea online." });
        setTimeout(() => setMessage(null), 3000);
      }
      onSamplesChange?.();
    } else if (editingId) {
      const { error } = await supabase
        .from("samples")
        .update(payload)
        .eq("id", editingId);
      if (error) {
        setMessage({ type: "error", text: `Eroare: ${error.message}` });
        setSaving(false);
        return;
      }
      setSamples((prev) =>
        prev.map((s) =>
          s.id === editingId ? { ...s, ...payload, id: s.id, created_at: s.created_at } : s
        ).sort((a, b) => a.depth_m - b.depth_m)
      );
      setEditingId(null);
      setMessage({ type: "success", text: "Probă actualizată." });
      setTimeout(() => setMessage(null), 3000);
      onSamplesChange?.();
    } else {
      const { data, error } = await supabase
        .from("samples")
        .insert(payload)
        .select()
        .single();
      if (error) {
        setMessage({ type: "error", text: `Eroare salvare: ${error.message}. Verifică dacă ai rulat migrarea 009_samples.sql în Supabase.` });
        setSaving(false);
        return;
      }
      if (data) {
        setSamples((prev) => [...prev, data as Sample].sort((a, b) => a.depth_m - b.depth_m));
        setMessage({ type: "success", text: "Probă adăugată cu succes." });
        setTimeout(() => setMessage(null), 3000);
        onSamplesChange?.();
      }
    }

    setForm(emptyForm());
    setSaving(false);
  }

  function startEdit(sample: Sample) {
    setEditingId(sample.id);
    setForm({
      depth_m: String(sample.depth_m),
      type: sample.type,
      spt_values: sample.spt_values ?? "",
      notes: sample.notes ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function handleDelete(id: string) {
    if (!confirm("Ștergi această probă?")) return;
    if (isOffline) {
      await addPendingFormOp({
        drillPointId,
        table: "samples",
        action: "delete",
        recordId: id,
      });
      setSamples((prev) => prev.filter((s) => s.id !== id));
      if (editingId === id) cancelEdit();
      onSamplesChange?.();
      return;
    }
    const { error } = await supabase.from("samples").delete().eq("id", id);
    if (error) {
      alert(`Eroare: ${error.message}`);
    } else {
      setSamples((prev) => prev.filter((s) => s.id !== id));
      if (editingId === id) cancelEdit();
      onSamplesChange?.();
    }
  }

  if (loading) {
    return (
      <section className="bg-white rounded-lg border shadow-sm p-4">
        <h2 className="font-semibold text-slate-800 mb-4">Probe</h2>
        <p className="text-sm text-slate-500">Se încarcă...</p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-lg border shadow-sm p-4">
      <h2 className="font-semibold text-slate-800 mb-4">Probe</h2>
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
      {/* Formular adăugare / editare */}
      <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="text-sm font-medium text-slate-700 mb-3">
          {editingId ? "Editează proba" : "Adaugă probă"}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Adâncime (m) *
            </label>
            <input
              type="text"
              value={form.depth_m}
              onChange={(e) => setForm((f) => ({ ...f, depth_m: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="ex: 2.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Tip *
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">— Selectează —</option>
              {SAMPLE_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Valori SPT
            </label>
            <input
              type="text"
              value={form.spt_values}
              onChange={(e) => setForm((f) => ({ ...f, spt_values: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="ex: 12, 14, 16"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Observații
            </label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Note"
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !form.depth_m.trim() || !form.type.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Se salvează..." : editingId ? "Actualizează" : "Adaugă"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
            >
              Anulează
            </button>
          )}
        </div>
      </div>

      {/* Lista probe */}
      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-2">Lista probe</h3>
        {samples.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">
            Nicio probă adăugată. Adaugă prima probă mai sus.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2">Adâncime (m)</th>
                  <th className="text-left py-2 px-2">Tip</th>
                  <th className="text-left py-2 px-2">Valori SPT</th>
                  <th className="text-left py-2 px-2">Observații</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {samples.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => startEdit(s)}
                    className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${editingId === s.id ? "bg-blue-50 ring-1 ring-blue-200" : ""}`}
                  >
                    <td className="py-2 px-2">{s.depth_m}</td>
                    <td className="py-2 px-2">{s.type}</td>
                    <td className="py-2 px-2">{s.spt_values || "—"}</td>
                    <td className="py-2 px-2">{s.notes || "—"}</td>
                    <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(s.id);
                        }}
                        className="text-red-600 hover:underline text-xs"
                      >
                        Șterge
                      </button>
                    </td>
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
