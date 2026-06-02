"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PocketPenetrometer } from "@/lib/types";
import { POCKET_PENETROMETER_PLUNGER_OPTIONS } from "@/lib/types";
import {
  addPendingFormOp,
  getPendingFormOps,
  applyPendingFormOpsToRecords,
} from "@/lib/offline-store";

function parseValori(valori: string): number[] {
  if (!valori.trim()) return [];
  return valori
    .split(/[,;\s]+/)
    .map((s) => parseFloat(s.trim().replace(",", ".")))
    .filter((n) => !isNaN(n));
}

function computeStats(valori: string): { medie: number; min: number; max: number } | null {
  const nums = parseValori(valori);
  if (nums.length === 0) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return {
    medie: Math.round((sum / nums.length) * 10) / 10,
    min: Math.round(Math.min(...nums) * 10) / 10,
    max: Math.round(Math.max(...nums) * 10) / 10,
  };
}

interface PocketPenetrometerSectionProps {
  drillPointId: string;
  /** Adâncimea finală a forajului (m). Dacă setată, interzice valori > aceasta. */
  finalDepth?: number | null;
  initialData?: PocketPenetrometer[];
  isOffline?: boolean;
}

const emptyForm = () => ({
  from_m: "",
  to_m: "",
  plunger: "",
  valori: "",
});

export default function PocketPenetrometerSection({
  drillPointId,
  finalDepth,
  initialData,
  isOffline = false,
}: PocketPenetrometerSectionProps) {
  const supabase = createClient();
  const [items, setItems] = useState<PocketPenetrometer[]>([]);
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
        const merged = applyPendingFormOpsToRecords(base, pending, "pocket_penetrometer") as PocketPenetrometer[];
        setItems(merged.sort((a, b) => a.from_m - b.from_m));
        setLoading(false);
      })();
      return;
    }
    const load = async () => {
      const { data, error } = await supabase
        .from("pocket_penetrometer")
        .select("*")
        .eq("drill_point_id", drillPointId)
        .order("from_m", { ascending: true });
      if (error) {
        console.error("Eroare încărcare pocket penetrometru:", error);
        setMessage({
          type: "error",
          text: `Tabelul pocket penetrometru nu există. Rulează migrarea 014_pocket_penetrometer.sql în Supabase: ${error.message}`,
        });
      }
      setItems((data as PocketPenetrometer[]) ?? []);
      setLoading(false);
    };
    load();
  }, [drillPointId, initialData, isOffline]);

  async function handleSave() {
    setMessage(null);
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
    if (!form.plunger.trim()) {
      setMessage({ type: "error", text: "Selectează tipul pistonului." });
      return;
    }
    const nums = parseValori(form.valori);
    if (nums.length === 0) {
      setMessage({ type: "error", text: "Introdu cel puțin o valoare în kg/cm² (separate prin virgulă)." });
      return;
    }

    setSaving(true);
    const payload = {
      drill_point_id: drillPointId,
      from_m: fromM,
      to_m: toM,
      plunger: form.plunger.trim(),
      valori: form.valori.trim(),
      updated_at: new Date().toISOString(),
    };

    if (isOffline) {
      if (editingId) {
        await addPendingFormOp({
          drillPointId,
          table: "pocket_penetrometer",
          action: "update",
          recordId: editingId,
          data: payload,
        });
        setItems((prev) =>
          prev
            .map((i) =>
              i.id === editingId ? { ...i, ...payload, id: i.id, created_at: i.created_at || new Date().toISOString() } : i
            )
            .sort((a, b) => a.from_m - b.from_m)
        );
        setEditingId(null);
        setMessage({ type: "success", text: "Actualizat local. Se va sincroniza la revenirea online." });
        setTimeout(() => setMessage(null), 3000);
      } else {
        const tempId = crypto.randomUUID();
        await addPendingFormOp({
          drillPointId,
          table: "pocket_penetrometer",
          action: "insert",
          recordId: tempId,
          data: payload,
        });
        const newItem = { ...payload, id: tempId, created_at: new Date().toISOString() } as PocketPenetrometer;
        setItems((prev) => [...prev, newItem].sort((a, b) => a.from_m - b.from_m));
        setMessage({ type: "success", text: "Adăugat local. Se va sincroniza la revenirea online." });
        setTimeout(() => setMessage(null), 3000);
      }
    } else if (editingId) {
      const { error } = await supabase
        .from("pocket_penetrometer")
        .update(payload)
        .eq("id", editingId);
      if (error) {
        setMessage({ type: "error", text: error.message });
        setSaving(false);
        return;
      }
      setItems((prev) =>
        prev
          .map((i) =>
            i.id === editingId ? { ...i, ...payload, id: i.id, created_at: i.created_at } : i
          )
          .sort((a, b) => a.from_m - b.from_m)
      );
      setEditingId(null);
      setMessage({ type: "success", text: "Pocket penetrometru actualizat." });
      setTimeout(() => setMessage(null), 3000);
    } else {
      const { data, error } = await supabase
        .from("pocket_penetrometer")
        .insert(payload)
        .select()
        .single();
      if (error) {
        setMessage({ type: "error", text: `Eroare salvare: ${error.message}` });
        setSaving(false);
        return;
      }
      if (data) {
        setItems((prev) =>
          [...prev, data as PocketPenetrometer].sort((a, b) => a.from_m - b.from_m)
        );
        setMessage({ type: "success", text: "Pocket penetrometru adăugat." });
        setTimeout(() => setMessage(null), 3000);
      }
    }

    setForm(emptyForm());
    setSaving(false);
  }

  function startEdit(item: PocketPenetrometer) {
    setEditingId(item.id);
    setForm({
      from_m: String(item.from_m),
      to_m: String(item.to_m),
      plunger: item.plunger,
      valori: item.valori,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function handleDelete(id: string) {
    if (!confirm("Ștergi această înregistrare pocket penetrometru?")) return;
    if (isOffline) {
      await addPendingFormOp({
        drillPointId,
        table: "pocket_penetrometer",
        action: "delete",
        recordId: id,
      });
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (editingId === id) cancelEdit();
      return;
    }
    const { error } = await supabase.from("pocket_penetrometer").delete().eq("id", id);
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (editingId === id) cancelEdit();
    }
  }

  if (loading) {
    return (
      <section className="bg-white rounded-lg border shadow-sm p-4">
        <h2 className="font-semibold text-slate-800 mb-4">Pocket Penetrometru</h2>
        <p className="text-sm text-slate-500">Se încarcă...</p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-lg border shadow-sm p-4">
      <h2 className="font-semibold text-slate-800 mb-4">Pocket Penetrometru</h2>
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

      <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="text-sm font-medium text-slate-700 mb-3">
          {editingId ? "Editează" : "Adaugă măsurătoare"}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">De la (m) *</label>
            <input
              type="text"
              value={form.from_m}
              onChange={(e) => setForm((f) => ({ ...f, from_m: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="ex: 0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Până la (m) *</label>
            <input
              type="text"
              value={form.to_m}
              onChange={(e) => setForm((f) => ({ ...f, to_m: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="ex: 0.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tip piston *</label>
            <select
              value={form.plunger}
              onChange={(e) => setForm((f) => ({ ...f, plunger: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">— Selectează —</option>
              {POCKET_PENETROMETER_PLUNGER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Valori (kg/cm²) * — separate prin virgulă
            </label>
            <input
              type="text"
              value={form.valori}
              onChange={(e) => setForm((f) => ({ ...f, valori: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="ex: 1, 2, 3, 2, 3"
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={
              saving ||
              !form.from_m.trim() ||
              !form.to_m.trim() ||
              !form.plunger.trim() ||
              !form.valori.trim()
            }
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

      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-2">Lista Pocket Penetrometru</h3>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">Nicio măsurătoare adăugată.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2">De la (m)</th>
                  <th className="text-left py-2 px-2">Până la (m)</th>
                  <th className="text-left py-2 px-2">Tip piston</th>
                  <th className="text-left py-2 px-2">Valori (kg/cm²)</th>
                  <th className="text-left py-2 px-2">Medie</th>
                  <th className="text-left py-2 px-2">Min</th>
                  <th className="text-left py-2 px-2">Max</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const stats = computeStats(i.valori);
                  return (
                    <tr
                      key={i.id}
                      onClick={() => startEdit(i)}
                      className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${
                        editingId === i.id ? "bg-blue-50 ring-1 ring-blue-200" : ""
                      }`}
                    >
                      <td className="py-2 px-2">{i.from_m}</td>
                      <td className="py-2 px-2">{i.to_m}</td>
                      <td className="py-2 px-2">{i.plunger}</td>
                      <td className="py-2 px-2">{i.valori}</td>
                      <td className="py-2 px-2">{stats ? stats.medie : "—"}</td>
                      <td className="py-2 px-2">{stats ? stats.min : "—"}</td>
                      <td className="py-2 px-2">{stats ? stats.max : "—"}</td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
