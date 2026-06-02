"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RqdTcrScr } from "@/lib/types";
import {
  addPendingFormOp,
  getPendingFormOps,
  applyPendingFormOpsToRecords,
} from "@/lib/offline-store";

function parseCarota(val: string): number[] {
  if (!val.trim()) return [];
  return val
    .split(/[,;\s]+/)
    .map((s) => parseFloat(s.trim().replace(",", ".")))
    .filter((n) => !isNaN(n) && n > 0);
}

function computeRqdScrTcr(item: RqdTcrScr): {
  rqd: number;
  scr: number;
  tcr: number | null;
} {
  const runLengthM = Number(item.to_m) - Number(item.from_m);
  if (runLengthM <= 0) return { rqd: 0, scr: 0, tcr: null };
  const runLengthCm = runLengthM * 100;
  const pieces = parseCarota(item.carota_gt_10cm);
  const sumGt10 = pieces.reduce((a, b) => a + b, 0);
  const rqd = Math.round((sumGt10 / runLengthCm) * 1000) / 10;
  const scr = rqd;
  const tcr =
    item.total_recovered_cm != null
      ? Math.round((Number(item.total_recovered_cm) / runLengthCm) * 1000) / 10
      : null;
  return { rqd, scr, tcr };
}

interface RqdTcrScrSectionProps {
  drillPointId: string;
  finalDepth?: number | null;
  initialData?: RqdTcrScr[];
  isOffline?: boolean;
}

const emptyForm = () => ({
  from_m: "",
  to_m: "",
  carota_gt_10cm: "",
  total_recovered_cm: "",
});

export default function RqdTcrScrSection({
  drillPointId,
  finalDepth,
  initialData,
  isOffline = false,
}: RqdTcrScrSectionProps) {
  const supabase = createClient();
  const [items, setItems] = useState<RqdTcrScr[]>([]);
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
        const merged = applyPendingFormOpsToRecords(base, pending, "rqd_tcr_scr") as RqdTcrScr[];
        setItems(merged.sort((a, b) => a.from_m - b.from_m));
        setLoading(false);
      })();
      return;
    }
    const load = async () => {
      const { data, error } = await supabase
        .from("rqd_tcr_scr")
        .select("*")
        .eq("drill_point_id", drillPointId)
        .order("from_m", { ascending: true });
      if (error) {
        console.error("Eroare încărcare RQD/TCR/SCR:", error);
        setMessage({
          type: "error",
          text: `Tabelul rqd_tcr_scr nu există. Rulează migrarea 016_rqd_tcr_scr.sql în Supabase: ${error.message}`,
        });
      }
      setItems((data as RqdTcrScr[]) ?? []);
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
    if (!form.carota_gt_10cm.trim()) {
      setMessage({ type: "error", text: "Introdu lungimile carotelor >10 cm (cm), separate prin virgulă." });
      return;
    }
    const pieces = parseCarota(form.carota_gt_10cm);
    if (pieces.length === 0) {
      setMessage({ type: "error", text: "Introdu cel puțin o valoare validă pentru carote >10 cm (cm)." });
      return;
    }

    const totalRecovered =
      form.total_recovered_cm.trim() !== ""
        ? parseFloat(String(form.total_recovered_cm).replace(",", "."))
        : null;
    if (
      totalRecovered !== null &&
      (isNaN(totalRecovered) || totalRecovered < 0 || totalRecovered > (toM - fromM) * 100)
    ) {
      setMessage({
        type: "error",
        text: `Recuperare totală invalidă (max. ${(toM - fromM) * 100} cm pentru acest interval).`,
      });
      return;
    }

    setSaving(true);
    const payload = {
      drill_point_id: drillPointId,
      from_m: fromM,
      to_m: toM,
      carota_gt_10cm: form.carota_gt_10cm.trim(),
      total_recovered_cm: totalRecovered,
      updated_at: new Date().toISOString(),
    };

    if (isOffline) {
      if (editingId) {
        await addPendingFormOp({
          drillPointId,
          table: "rqd_tcr_scr",
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
          table: "rqd_tcr_scr",
          action: "insert",
          recordId: tempId,
          data: payload,
        });
        const newItem = { ...payload, id: tempId, created_at: new Date().toISOString() } as RqdTcrScr;
        setItems((prev) => [...prev, newItem].sort((a, b) => a.from_m - b.from_m));
        setMessage({ type: "success", text: "Adăugat local. Se va sincroniza la revenirea online." });
        setTimeout(() => setMessage(null), 3000);
      }
    } else if (editingId) {
      const { error } = await supabase
        .from("rqd_tcr_scr")
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
      setMessage({ type: "success", text: "RQD/TCR/SCR actualizat." });
      setTimeout(() => setMessage(null), 3000);
    } else {
      const { data, error } = await supabase
        .from("rqd_tcr_scr")
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
          [...prev, data as RqdTcrScr].sort((a, b) => a.from_m - b.from_m)
        );
        setMessage({ type: "success", text: "RQD/TCR/SCR adăugat." });
        setTimeout(() => setMessage(null), 3000);
      }
    }

    setForm(emptyForm());
    setSaving(false);
  }

  function startEdit(item: RqdTcrScr) {
    setEditingId(item.id);
    setForm({
      from_m: String(item.from_m),
      to_m: String(item.to_m),
      carota_gt_10cm: item.carota_gt_10cm,
      total_recovered_cm: item.total_recovered_cm != null ? String(item.total_recovered_cm) : "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function handleDelete(id: string) {
    if (!confirm("Ștergi această înregistrare RQD/TCR/SCR?")) return;
    if (isOffline) {
      await addPendingFormOp({
        drillPointId,
        table: "rqd_tcr_scr",
        action: "delete",
        recordId: id,
      });
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (editingId === id) cancelEdit();
      return;
    }
    const { error } = await supabase.from("rqd_tcr_scr").delete().eq("id", id);
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
        <h2 className="font-semibold text-slate-800 mb-4">RQD, TCR, SCR</h2>
        <p className="text-sm text-slate-500">Se încarcă...</p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-lg border shadow-sm p-4">
      <h2 className="font-semibold text-slate-800 mb-4">RQD, TCR, SCR</h2>
      <p className="text-xs text-slate-500 mb-4">
        Carote &gt;10 cm: lungimile bucăților de carotă în cm (ex: 25, 30, 20). RQD% și SCR% se calculează automat. Regula SCR: &gt;10 cm.
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
          {editingId ? "Editează" : "Adaugă interval"}
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
              placeholder="ex: 31"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Carote &gt;10 cm (cm) * — lungimi separate prin virgulă
            </label>
            <input
              type="text"
              value={form.carota_gt_10cm}
              onChange={(e) => setForm((f) => ({ ...f, carota_gt_10cm: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="ex: 25, 30, 20, 15"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Recuperare totală (cm) — opțional, pentru TCR%
            </label>
            <input
              type="text"
              value={form.total_recovered_cm}
              onChange={(e) => setForm((f) => ({ ...f, total_recovered_cm: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="ex: 100 (dacă 100% recuperare)"
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
              !form.carota_gt_10cm.trim()
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
        <h3 className="text-sm font-medium text-slate-700 mb-2">Lista RQD, TCR, SCR</h3>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">Niciun interval adăugat.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2">De la (m)</th>
                  <th className="text-left py-2 px-2">Până la (m)</th>
                  <th className="text-left py-2 px-2">Carote &gt;10 cm</th>
                  <th className="text-left py-2 px-2">RQD %</th>
                  <th className="text-left py-2 px-2">TCR %</th>
                  <th className="text-left py-2 px-2">SCR %</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const { rqd, scr, tcr } = computeRqdScrTcr(i);
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
                      <td className="py-2 px-2">{i.carota_gt_10cm}</td>
                      <td className="py-2 px-2">{rqd}</td>
                      <td className="py-2 px-2">{tcr ?? "—"}</td>
                      <td className="py-2 px-2">{scr}</td>
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
