"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PocketVaneTest } from "@/lib/types";
import { POCKET_VANE_OPTIONS } from "@/lib/types";
import {
  addPendingFormOp,
  getPendingFormOps,
  applyPendingFormOpsToRecords,
} from "@/lib/offline-store";

const VANE_FACTORS: Record<string, number> = {
  "25.4": 0.49,
  "20": 1.0,
  "16": 1.95,
};

function getFactor(diameter: string): number {
  return VANE_FACTORS[diameter] ?? 1;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function parseDateInput(s: string): string | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/[.\-\/]/).map((p) => parseInt(p, 10));
  if (parts.length >= 3) {
    const [d, m, y] = parts;
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y > 1900) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return null;
}

interface PocketVaneTestSectionProps {
  drillPointId: string;
  /** Adâncimea finală a forajului (m). */
  finalDepth?: number | null;
  initialData?: PocketVaneTest[];
  isOffline?: boolean;
}

const emptyForm = () => ({
  from_m: "",
  to_m: "",
  value_kg_cm2: "",
  vane_diameter: "",
  test_date: "",
});

export default function PocketVaneTestSection({
  drillPointId,
  finalDepth,
  initialData,
  isOffline = false,
}: PocketVaneTestSectionProps) {
  const supabase = createClient();
  const [items, setItems] = useState<PocketVaneTest[]>([]);
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
        const merged = applyPendingFormOpsToRecords(base, pending, "pocket_vane_test") as PocketVaneTest[];
        setItems(merged.sort((a, b) => a.from_m - b.from_m));
        setLoading(false);
      })();
      return;
    }
    const load = async () => {
      const { data, error } = await supabase
        .from("pocket_vane_test")
        .select("*")
        .eq("drill_point_id", drillPointId)
        .order("from_m", { ascending: true });
      if (error) {
        console.error("Eroare încărcare Pocket Vane Test:", error);
        setMessage({
          type: "error",
          text: `Tabelul pocket_vane_test nu există. Rulează migrarea 015_pocket_vane_test.sql în Supabase: ${error.message}`,
        });
      }
      setItems((data as PocketVaneTest[]) ?? []);
      setLoading(false);
    };
    load();
  }, [drillPointId, initialData, isOffline]);

  async function handleSave() {
    setMessage(null);
    const fromM = parseFloat(String(form.from_m).replace(",", "."));
    const toM = parseFloat(String(form.to_m).replace(",", "."));
    const valueM = parseFloat(String(form.value_kg_cm2).replace(",", "."));
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
    if (isNaN(valueM) || valueM < 0) {
      setMessage({ type: "error", text: "Valoare invalidă (kg/cm²)." });
      return;
    }
    if (!form.vane_diameter.trim()) {
      setMessage({ type: "error", text: "Selectează diametrul vanei." });
      return;
    }

    const testDate = parseDateInput(form.test_date);

    setSaving(true);
    const payload = {
      drill_point_id: drillPointId,
      from_m: fromM,
      to_m: toM,
      value_kg_cm2: valueM,
      vane_diameter: form.vane_diameter.trim(),
      test_date: testDate,
      updated_at: new Date().toISOString(),
    };

    if (isOffline) {
      if (editingId) {
        await addPendingFormOp({
          drillPointId,
          table: "pocket_vane_test",
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
          table: "pocket_vane_test",
          action: "insert",
          recordId: tempId,
          data: payload,
        });
        const newItem = { ...payload, id: tempId, created_at: new Date().toISOString() } as PocketVaneTest;
        setItems((prev) => [...prev, newItem].sort((a, b) => a.from_m - b.from_m));
        setMessage({ type: "success", text: "Adăugat local. Se va sincroniza la revenirea online." });
        setTimeout(() => setMessage(null), 3000);
      }
    } else if (editingId) {
      const { error } = await supabase
        .from("pocket_vane_test")
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
      setMessage({ type: "success", text: "Pocket Vane Test actualizat." });
      setTimeout(() => setMessage(null), 3000);
    } else {
      const { data, error } = await supabase
        .from("pocket_vane_test")
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
          [...prev, data as PocketVaneTest].sort((a, b) => a.from_m - b.from_m)
        );
        setMessage({ type: "success", text: "Pocket Vane Test adăugat." });
        setTimeout(() => setMessage(null), 3000);
      }
    }

    setForm(emptyForm());
    setSaving(false);
  }

  function startEdit(item: PocketVaneTest) {
    setEditingId(item.id);
    setForm({
      from_m: String(item.from_m),
      to_m: String(item.to_m),
      value_kg_cm2: String(item.value_kg_cm2),
      vane_diameter: item.vane_diameter,
      test_date: item.test_date ? formatDate(item.test_date) : "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function handleDelete(id: string) {
    if (!confirm("Ștergi această înregistrare Pocket Vane Test?")) return;
    if (isOffline) {
      await addPendingFormOp({
        drillPointId,
        table: "pocket_vane_test",
        action: "delete",
        recordId: id,
      });
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (editingId === id) cancelEdit();
      return;
    }
    const { error } = await supabase.from("pocket_vane_test").delete().eq("id", id);
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
        <h2 className="font-semibold text-slate-800 mb-4">Pocket Vane Test</h2>
        <p className="text-sm text-slate-500">Se încarcă...</p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-lg border shadow-sm p-4">
      <h2 className="font-semibold text-slate-800 mb-4">Pocket Vane Test</h2>
      <p className="text-xs text-slate-500 mb-4">
        Valori citite din test. Su (rezistență la forfecare) = citire × factor corecție (25.4 mm: ×0.49, 20 mm: ×1.00, 16 mm: ×1.95).
      </p>
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
              placeholder="ex: 30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Până la (m) *</label>
            <input
              type="text"
              value={form.to_m}
              onChange={(e) => setForm((f) => ({ ...f, to_m: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="ex: 30.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Valoare citită (kg/cm²) *
            </label>
            <input
              type="text"
              value={form.value_kg_cm2}
              onChange={(e) => setForm((f) => ({ ...f, value_kg_cm2: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="ex: 9 sau 1.8"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Diametru vane *
            </label>
            <select
              value={form.vane_diameter}
              onChange={(e) => setForm((f) => ({ ...f, vane_diameter: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">— Selectează —</option>
              {POCKET_VANE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Data test (opțional)
            </label>
            <input
              type="text"
              value={form.test_date}
              onChange={(e) => setForm((f) => ({ ...f, test_date: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="ex: 04.02.2026"
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
              !form.value_kg_cm2.trim() ||
              !form.vane_diameter.trim()
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
        <h3 className="text-sm font-medium text-slate-700 mb-2">Lista Pocket Vane Test</h3>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">Nicio măsurătoare adăugată.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2">Interval (m)</th>
                  <th className="text-left py-2 px-2">Valoare citită (kg/cm²)</th>
                  <th className="text-left py-2 px-2">Su corectat (kg/cm²)</th>
                  <th className="text-left py-2 px-2">Data</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const factor = getFactor(i.vane_diameter);
                  const su = Math.round(Number(i.value_kg_cm2) * factor * 10) / 10;
                  return (
                    <tr
                      key={i.id}
                      onClick={() => startEdit(i)}
                      className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${
                        editingId === i.id ? "bg-blue-50 ring-1 ring-blue-200" : ""
                      }`}
                    >
                      <td className="py-2 px-2">
                        {i.from_m}-{i.to_m}
                      </td>
                      <td className="py-2 px-2">{i.value_kg_cm2} kg/cm²</td>
                      <td className="py-2 px-2">{su} kg/cm²</td>
                      <td className="py-2 px-2">{formatDate(i.test_date)}</td>
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
