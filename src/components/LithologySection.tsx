"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LithologyInterval } from "@/lib/types";
import {
  LITHOLOGY_TYPE_OPTIONS,
  LITHOLOGY_CONSISTENCY_OPTIONS,
  LITHOLOGY_INDESARE_OPTIONS,
  LITHOLOGY_TYPES_CONSISTENCY,
  LITHOLOGY_TYPES_INDESARE,
  LITHOLOGY_COLOR_OPTIONS,
} from "@/lib/types";
import {
  addPendingFormOp,
  getPendingFormOps,
  applyPendingFormOpsToRecords,
} from "@/lib/offline-store";

function getConsistencyOrIndesareOptions(type: string) {
  if (LITHOLOGY_TYPES_CONSISTENCY.includes(type as (typeof LITHOLOGY_TYPES_CONSISTENCY)[number])) {
    return { label: "Consistență", options: LITHOLOGY_CONSISTENCY_OPTIONS, field: "consistency" as const };
  }
  if (LITHOLOGY_TYPES_INDESARE.includes(type as (typeof LITHOLOGY_TYPES_INDESARE)[number])) {
    return { label: "Indesare Necoeziv", options: LITHOLOGY_INDESARE_OPTIONS, field: "sand_compaction" as const };
  }
  return null;
}

interface LithologySectionProps {
  drillPointId: string;
  /** Adâncimea finală a forajului (m). Dacă setată, interzice valori > aceasta. */
  finalDepth?: number | null;
  initialData?: LithologyInterval[];
  isOffline?: boolean;
}

const emptyForm = () => ({
  from_m: "",
  to_m: "",
  type: "",
  consistency: "",
  color: "",
  sand_compaction: "",
  notes: "",
});

export default function LithologySection({ drillPointId, finalDepth, initialData, isOffline = false }: LithologySectionProps) {
  const supabase = createClient();
  const [intervals, setIntervals] = useState<LithologyInterval[]>([]);
  const [loading, setLoading] = useState(!isOffline);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    if (isOffline) {
      (async () => {
        const base = (initialData ?? []).sort((a, b) => a.from_m - b.from_m);
        const pending = await getPendingFormOps(drillPointId);
        const merged = applyPendingFormOpsToRecords(base, pending, "lithology_intervals") as LithologyInterval[];
        setIntervals(merged.sort((a, b) => a.from_m - b.from_m));
        setLoading(false);
      })();
      return;
    }
    const load = async () => {
      const { data, error } = await supabase
        .from("lithology_intervals")
        .select("*")
        .eq("drill_point_id", drillPointId)
        .order("from_m", { ascending: true });
      if (error) {
        console.error("Eroare încărcare litologie:", error);
        setMessage({ type: "error", text: `Tabelul litologie nu există sau nu ai acces. Rulează migrarea 008 în Supabase: ${error.message}` });
      }
      setIntervals((data as LithologyInterval[]) ?? []);
      setLoading(false);
    };
    load();
  }, [drillPointId, initialData, isOffline]);

  async function handleSave() {
    const fromM = parseFloat(String(form.from_m).replace(",", "."));
    const toM = parseFloat(String(form.to_m).replace(",", "."));
    if (isNaN(fromM) || isNaN(toM) || fromM >= toM) {
      setMessage({ type: "error", text: "Interval invalid: de la (m) < până la (m)" });
      return;
    }
    if (finalDepth != null && (fromM > finalDepth || toM > finalDepth)) {
      setMessage({
        type: "error",
        text: `Adâncimea depășește forajul (max. ${finalDepth} m). Introdu valori ≤ ${finalDepth} m.`,
      });
      return;
    }

    setSaving(true);
    const payload = {
      drill_point_id: drillPointId,
      from_m: fromM,
      to_m: toM,
      type: form.type.trim() || null,
      consistency: form.consistency.trim() || null,
      color: form.color.trim() || null,
      sand_compaction: form.sand_compaction.trim() || null,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (isOffline) {
      if (editingId) {
        await addPendingFormOp({
          drillPointId,
          table: "lithology_intervals",
          action: "update",
          recordId: editingId,
          data: payload,
        });
        setIntervals((prev) =>
          prev.map((i) =>
            i.id === editingId ? { ...i, ...payload, id: i.id, created_at: i.created_at || new Date().toISOString() } : i
          )
        );
        setEditingId(null);
        setMessage({ type: "success", text: "Strat actualizat local. Se va sincroniza la revenirea online." });
        setTimeout(() => setMessage(null), 3000);
      } else {
        const tempId = crypto.randomUUID();
        await addPendingFormOp({
          drillPointId,
          table: "lithology_intervals",
          action: "insert",
          recordId: tempId,
          data: payload,
        });
        const newInterval = { ...payload, id: tempId, created_at: new Date().toISOString() } as LithologyInterval;
        setIntervals((prev) => [...prev, newInterval].sort((a, b) => a.from_m - b.from_m));
        setMessage({ type: "success", text: "Strat adăugat local. Se va sincroniza la revenirea online." });
        setTimeout(() => setMessage(null), 3000);
      }
    } else if (editingId) {
      const { error } = await supabase
        .from("lithology_intervals")
        .update(payload)
        .eq("id", editingId);
      if (error) {
        setMessage({ type: "error", text: error.message });
        setSaving(false);
        return;
      }
      setIntervals((prev) =>
        prev.map((i) =>
          i.id === editingId ? { ...i, ...payload, id: i.id, created_at: i.created_at } : i
        )
      );
      setEditingId(null);
      setMessage({ type: "success", text: "Strat actualizat." });
      setTimeout(() => setMessage(null), 3000);
    } else {
      const { data, error } = await supabase
        .from("lithology_intervals")
        .insert(payload)
        .select()
        .single();
      if (error) {
        setMessage({ type: "error", text: `Eroare salvare: ${error.message}. Verifică dacă ai rulat migrarea 008_lithology_intervals.sql în Supabase.` });
        setSaving(false);
        return;
      }
      if (data) {
        setIntervals((prev) => [...prev, data as LithologyInterval].sort((a, b) => a.from_m - b.from_m));
        setMessage({ type: "success", text: "Strat adăugat cu succes." });
        setTimeout(() => setMessage(null), 3000);
      } else {
        const { data: refreshed } = await supabase
          .from("lithology_intervals")
          .select("*")
          .eq("drill_point_id", drillPointId)
          .order("from_m", { ascending: true });
        setIntervals((refreshed as LithologyInterval[]) ?? []);
      }
    }

    setForm(emptyForm());
    setSaving(false);
  }

  function startEdit(interval: LithologyInterval) {
    setEditingId(interval.id);
    setForm({
      from_m: String(interval.from_m),
      to_m: String(interval.to_m),
      type: interval.type ?? "",
      consistency: interval.consistency ?? "",
      color: interval.color ?? "",
      sand_compaction: interval.sand_compaction ?? "",
      notes: interval.notes ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function handleDelete(id: string) {
    if (!confirm("Ștergi acest interval?")) return;
    if (isOffline) {
      await addPendingFormOp({
        drillPointId,
        table: "lithology_intervals",
        action: "delete",
        recordId: id,
      });
      setIntervals((prev) => prev.filter((i) => i.id !== id));
      if (editingId === id) cancelEdit();
      return;
    }
    const { error } = await supabase
      .from("lithology_intervals")
      .delete()
      .eq("id", id);
    if (error) {
      alert(`Eroare: ${error.message}`);
    } else {
      setIntervals((prev) => prev.filter((i) => i.id !== id));
      if (editingId === id) cancelEdit();
    }
  }

  if (loading) {
    return (
      <section className="bg-white rounded-lg border shadow-sm p-4">
        <h2 className="font-semibold text-slate-800 mb-4">Litologie</h2>
        <p className="text-sm text-slate-500">Se încarcă...</p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-lg border shadow-sm p-4">
      <h2 className="font-semibold text-slate-800 mb-4">Litologie</h2>
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
          {editingId ? "Editează interval" : "Adaugă interval"}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              De la (m) *
            </label>
            <input
              type="text"
              value={form.from_m}
              onChange={(e) => setForm((f) => ({ ...f, from_m: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="ex: 0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Până la (m) *
            </label>
            <input
              type="text"
              value={form.to_m}
              onChange={(e) => setForm((f) => ({ ...f, to_m: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="ex: 2.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Tip litologic
            </label>
            <select
              value={form.type}
              onChange={(e) => {
                const newType = e.target.value;
                const opts = getConsistencyOrIndesareOptions(newType);
                setForm((f) => ({
                  ...f,
                  type: newType,
                  consistency: opts?.field === "consistency" ? f.consistency : "",
                  sand_compaction: opts?.field === "sand_compaction" ? f.sand_compaction : "",
                }));
              }}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">— Selectează —</option>
              {LITHOLOGY_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          {(() => {
            const opts = getConsistencyOrIndesareOptions(form.type);
            if (!opts) return null;
            return (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {opts.label}
                </label>
                <select
                  value={opts.field === "consistency" ? form.consistency : form.sand_compaction}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      [opts.field]: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">— Selectează —</option>
                  {opts.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            );
          })()}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Culoare
            </label>
            <select
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">— Selectează —</option>
              {LITHOLOGY_COLOR_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Observații
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Note suplimentare"
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !form.from_m.trim() || !form.to_m.trim()}
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

      {/* Lista straturi */}
      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-2">Lista straturi</h3>
        {intervals.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">
            Niciun strat adăugat. Adaugă primul strat mai sus.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2">De la (m)</th>
                  <th className="text-left py-2 px-2">Până la (m)</th>
                  <th className="text-left py-2 px-2">Tip</th>
                  <th className="text-left py-2 px-2">Consistență / Indesare Necoeziv</th>
                  <th className="text-left py-2 px-2">Culoare</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {intervals.map((i) => (
                  <tr
                    key={i.id}
                    onClick={() => startEdit(i)}
                    className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${editingId === i.id ? "bg-blue-50 ring-1 ring-blue-200" : ""}`}
                  >
                    <td className="py-2 px-2">{i.from_m}</td>
                    <td className="py-2 px-2">{i.to_m}</td>
                    <td className="py-2 px-2">{i.type || "—"}</td>
                    <td className="py-2 px-2">{i.consistency || i.sand_compaction || "—"}</td>
                    <td className="py-2 px-2">{i.color || "—"}</td>
                    <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(i.id);
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
