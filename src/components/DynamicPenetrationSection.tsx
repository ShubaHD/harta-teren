"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DynamicPenetrationInterval } from "@/lib/types";
import { addPendingFormOp, getPendingFormOps, applyPendingFormOpsToRecords } from "@/lib/offline-store";
import DynamicPenetrationDiagram from "./DynamicPenetrationDiagram";

const INTERVAL_CM: Record<string, number> = {
  DPSH: 20,
  DPM: 10,
  DPL: 10,
  DPH: 10,
};

interface DynamicPenetrationSectionProps {
  drillPointId: string;
  tip: "DPSH" | "DPM" | "DPL" | "DPH";
  finalDepth?: number | null;
  initialData?: DynamicPenetrationInterval[];
  isOffline?: boolean;
}

function generateIntervals(tip: string, maxDepthM: number): { from_m: number; to_m: number }[] {
  const stepM = (INTERVAL_CM[tip] ?? 10) / 100;
  const out: { from_m: number; to_m: number }[] = [];
  for (let from = 0; from < maxDepthM; from += stepM) {
    const to = Math.min(from + stepM, maxDepthM);
    out.push({ from_m: Math.round(from * 1000) / 1000, to_m: Math.round(to * 1000) / 1000 });
    if (to >= maxDepthM) break;
  }
  return out;
}

export default function DynamicPenetrationSection({
  drillPointId,
  tip,
  finalDepth,
  initialData = [],
  isOffline = false,
}: DynamicPenetrationSectionProps) {
  const supabase = createClient();
  const stepCm = INTERVAL_CM[tip] ?? 10;
  const [intervals, setIntervals] = useState<DynamicPenetrationInterval[]>([]);
  const [loading, setLoading] = useState(!isOffline);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [localBlows, setLocalBlows] = useState<Record<string, number>>({});

  const maxDepth = finalDepth ?? 10;
  const intervalSlots = useMemo(() => generateIntervals(tip, maxDepth), [tip, maxDepth]);

  useEffect(() => {
    if (isOffline) {
      (async () => {
        const base = (initialData ?? []).sort((a, b) => a.from_m - b.from_m);
        const pending = await getPendingFormOps(drillPointId);
        const merged = applyPendingFormOpsToRecords(base, pending, "dynamic_penetration_intervals") as DynamicPenetrationInterval[];
        setIntervals(merged);
        const map: Record<string, number> = {};
        for (const i of merged) {
          const key = `${i.from_m}-${i.to_m}`;
          map[key] = i.blows;
        }
        setLocalBlows(map);
        setLoading(false);
      })();
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from("dynamic_penetration_intervals")
        .select("*")
        .eq("drill_point_id", drillPointId)
        .order("from_m", { ascending: true });
      const list = (data ?? []) as DynamicPenetrationInterval[];
      setIntervals(list);
      const map: Record<string, number> = {};
      for (const i of list) {
        const key = `${i.from_m}-${i.to_m}`;
        map[key] = i.blows;
      }
      setLocalBlows(map);
      setLoading(false);
    };
    load();
  }, [drillPointId, initialData, isOffline]);

  function getBlows(slot: { from_m: number; to_m: number }): number {
    const key = `${slot.from_m}-${slot.to_m}`;
    if (localBlows[key] !== undefined) return localBlows[key];
    const found = intervals.find((i) => Math.abs(i.from_m - slot.from_m) < 0.001 && Math.abs(i.to_m - slot.to_m) < 0.001);
    return found?.blows ?? 0;
  }

  function setBlows(slot: { from_m: number; to_m: number }, blows: number) {
    const key = `${slot.from_m}-${slot.to_m}`;
    setLocalBlows((prev) => ({ ...prev, [key]: blows }));
  }

  /** Valoare salvată (din server/pending) pentru un slot */
  function getSavedBlows(slot: { from_m: number; to_m: number }): number {
    const found = intervals.find((i) => Math.abs(i.from_m - slot.from_m) < 0.001 && Math.abs(i.to_m - slot.to_m) < 0.001);
    return found?.blows ?? 0;
  }

  async function persistBlows(slot: { from_m: number; to_m: number }, blows: number) {
    setMessage(null);
    const payload = {
      drill_point_id: drillPointId,
      from_m: slot.from_m,
      to_m: slot.to_m,
      blows: Math.max(0, Math.round(blows)),
      updated_at: new Date().toISOString(),
    };

    const existing = intervals.find(
      (i) => Math.abs(i.from_m - slot.from_m) < 0.001 && Math.abs(i.to_m - slot.to_m) < 0.001
    );

    if (isOffline) {
      if (existing) {
        await addPendingFormOp({
          drillPointId,
          table: "dynamic_penetration_intervals",
          action: "update",
          recordId: existing.id,
          data: payload,
        });
      } else {
        await addPendingFormOp({
          drillPointId,
          table: "dynamic_penetration_intervals",
          action: "insert",
          data: { ...payload, id: crypto.randomUUID() },
        });
      }
      setIntervals((prev) => {
        const filtered = prev.filter(
          (i) => Math.abs(i.from_m - slot.from_m) >= 0.001 || Math.abs(i.to_m - slot.to_m) >= 0.001
        );
        return [...filtered, { ...payload, id: existing?.id ?? crypto.randomUUID(), blows: payload.blows } as DynamicPenetrationInterval].sort(
          (a, b) => a.from_m - b.from_m
        );
      });
      setMessage({ type: "success", text: "Salvat local. Se va sincroniza la revenirea online." });
      setTimeout(() => setMessage(null), 2000);
      return;
    }

    setSaving(true);
    try {
      if (existing) {
        const { error } = await supabase
          .from("dynamic_penetration_intervals")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("dynamic_penetration_intervals")
          .insert({ ...payload, id: undefined })
          .select("id")
          .single();
        if (error) throw error;
        if (inserted) {
          setIntervals((prev) =>
            [...prev, { ...payload, id: inserted.id, blows: payload.blows } as DynamicPenetrationInterval].sort(
              (a, b) => a.from_m - b.from_m
            )
          );
        }
      }
      setMessage({ type: "success", text: "Salvat." });
      setTimeout(() => setMessage(null), 2000);
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Eroare la salvare." });
    } finally {
      setSaving(false);
    }
  }

  /** Salvează toate intervalele care au valori modificate față de cele salvate */
  async function saveAll() {
    setMessage(null);
    const toSave: { slot: { from_m: number; to_m: number }; blows: number }[] = [];
    for (const slot of intervalSlots) {
      const current = getBlows(slot);
      const saved = getSavedBlows(slot);
      if (current !== saved) toSave.push({ slot, blows: current });
    }
    if (toSave.length === 0) {
      setMessage({ type: "success", text: "Nu există modificări de salvat." });
      setTimeout(() => setMessage(null), 2000);
      return;
    }
    setSaving(true);
    try {
      if (isOffline) {
        for (const { slot, blows } of toSave) {
          await persistBlows(slot, blows);
        }
        setMessage({ type: "success", text: "Salvat local. Se va sincroniza la revenirea online." });
      } else {
        await Promise.all(toSave.map(({ slot, blows }) => persistBlows(slot, blows)));
        setMessage({ type: "success", text: `${toSave.length} interval(e) salvat(e).` });
      }
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: "error", text: "Eroare la salvare." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="bg-white rounded-lg border shadow-sm p-4">
        <h2 className="font-semibold text-slate-800 mb-4">Penetrare dinamică ({tip})</h2>
        <p className="text-slate-600 text-sm">Se încarcă...</p>
      </section>
    );
  }

  if (finalDepth == null || finalDepth <= 0) {
    return (
      <section className="bg-white rounded-lg border shadow-sm p-4">
        <h2 className="font-semibold text-slate-800 mb-4">Penetrare dinamică ({tip})</h2>
        <p className="text-amber-700 text-sm">
          Introdu mai întâi adâncimea finală (m) în secțiunea Date foraj.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-lg border shadow-sm p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="font-semibold text-slate-800">Penetrare dinamică ({tip})</h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Interval bătăi: {stepCm} cm. Introdu numărul de bătăi pentru fiecare interval.
          </p>
        </div>
        <button
          type="button"
          onClick={saveAll}
          disabled={saving}
          className="px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Se salvează..." : "Salvează"}
        </button>
      </div>
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === "error" ? "bg-red-50 text-red-800 border border-red-200" : "bg-green-50 text-green-800 border border-green-200"
          }`}
        >
          {message.text}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {intervalSlots.map((slot) => (
          <div
            key={`${slot.from_m}-${slot.to_m}`}
            className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200"
          >
            <span className="text-xs font-medium text-slate-600 shrink-0">
              {slot.from_m}–{slot.to_m} m
            </span>
            <input
              type="number"
              min={0}
              step={1}
              value={getBlows(slot)}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setBlows(slot, isNaN(v) ? 0 : v);
              }}
              onBlur={(e) => {
                const v = parseInt(e.target.value, 10);
                const val = isNaN(v) ? 0 : Math.max(0, v);
                if (val !== getSavedBlows(slot)) persistBlows(slot, val);
              }}
              className="w-16 px-2 py-1.5 border rounded text-sm text-center"
              placeholder="0"
            />
            <span className="text-xs text-slate-500">bătăi</span>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <DynamicPenetrationDiagram
          intervals={intervalSlots.map((slot) => {
            const blows = getBlows(slot);
            const existing = intervals.find(
              (i) => Math.abs(i.from_m - slot.from_m) < 0.001 && Math.abs(i.to_m - slot.to_m) < 0.001
            );
            return {
              id: existing?.id ?? `${slot.from_m}-${slot.to_m}`,
              drill_point_id: drillPointId,
              from_m: slot.from_m,
              to_m: slot.to_m,
              blows,
              created_at: existing?.created_at ?? "",
              updated_at: existing?.updated_at ?? "",
            };
          })}
          tip={tip}
        />
      </div>
    </section>
  );
}
