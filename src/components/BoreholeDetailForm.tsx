"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { DrillPoint, Project } from "@/lib/types";
import { TIP_INSTALATIE_OPTIONS, TIP_PENETRARE_DINAMICA_OPTIONS } from "@/lib/types";
import { addPendingDrillPointFields } from "@/lib/offline-store";
import LithologySection from "./LithologySection";
import SamplesSection from "./SamplesSection";
import NivelApaSection from "./NivelApaSection";
import EquipmentSection from "./EquipmentSection";
import PocketPenetrometerSection from "./PocketPenetrometerSection";
import PocketVaneTestSection from "./PocketVaneTestSection";
import RqdTcrScrSection from "./RqdTcrScrSection";
import PhotoSection from "./PhotoSection";
import ExportSection from "./ExportSection";
import DynamicPenetrationSection from "./DynamicPenetrationSection";
import type { CachedDrillPointDetail } from "@/lib/offline-store";

interface BoreholeDetailFormProps {
  point: DrillPoint;
  project?: Project | null;
  detail?: CachedDrillPointDetail | null;
  isOffline?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  de_facut: "De făcut",
  in_lucru: "În lucru",
  finalizat: "Finalizat",
};

export default function BoreholeDetailForm({ point, project, detail, isOffline = false }: BoreholeDetailFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [samplesRefreshKey, setSamplesRefreshKey] = useState(0);
  const [form, setForm] = useState({
    tip_instalatie: point.tip_instalatie ?? "",
    tip_penetrare_dinamica: point.tip_penetrare_dinamica ?? "",
    intocmit: point.intocmit ?? "",
    final_depth: point.final_depth ?? "",
    kilometraj: point.kilometraj ?? "",
    elevation_h: point.elevation_h ?? "",
    lat: String(point.lat),
    lng: String(point.lng),
    notes: point.notes ?? "",
  });
  const [gettingLocation, setGettingLocation] = useState(false);
  const [dateForajMessage, setDateForajMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialRender = useRef(true);

  const finalDepth = (() => {
    const raw = (form.final_depth || point.final_depth || "").toString().trim();
    if (!raw) return null;
    const n = parseFloat(raw.replace(",", "."));
    return isNaN(n) ? null : n;
  })();

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);
      setDateForajMessage(null);
      const lat = parseFloat(form.lat.replace(",", "."));
      const lng = parseFloat(form.lng.replace(",", "."));

      if (isOffline) {
        await addPendingDrillPointFields(point.id, {
          tip_instalatie: form.tip_instalatie.trim() || null,
          tip_penetrare_dinamica: form.tip_penetrare_dinamica.trim() || null,
          intocmit: form.intocmit.trim() || null,
          final_depth: form.final_depth.trim() || null,
          kilometraj: form.kilometraj.trim() || null,
          elevation_h: form.elevation_h.trim() || null,
          lat: isNaN(lat) ? point.lat : lat,
          lng: isNaN(lng) ? point.lng : lng,
          notes: form.notes.trim() || null,
        });
        setDateForajMessage({ type: "success", text: "Salvat local. Se va sincroniza la revenirea online." });
        setTimeout(() => setDateForajMessage(null), 3000);
      } else {
        const { data, error } = await supabase
          .from("drill_points")
          .update({
            tip_instalatie: form.tip_instalatie.trim() || null,
            tip_penetrare_dinamica: form.tip_penetrare_dinamica.trim() || null,
            intocmit: form.intocmit.trim() || null,
            final_depth: form.final_depth.trim() || null,
            kilometraj: form.kilometraj.trim() || null,
            elevation_h: form.elevation_h.trim() || null,
            lat: isNaN(lat) ? point.lat : lat,
            lng: isNaN(lng) ? point.lng : lng,
            notes: form.notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", point.id)
          .select("id");
        if (error) {
          setDateForajMessage({ type: "error", text: `Eroare auto-save: ${error.message}` });
        } else if (!data || data.length === 0) {
          setDateForajMessage({ type: "error", text: "Date foraj nu s-au salvat (probabil lipsesc permisiuni). Apasă Salvează." });
        }
      }
      setSaving(false);
    }, 800);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [form, point.id, point.lat, point.lng, supabase, isOffline]);

  async function handleSaveDateForaj() {
    setSaving(true);
    setDateForajMessage(null);
    const lat = parseFloat(form.lat.replace(",", "."));
    const lng = parseFloat(form.lng.replace(",", "."));
    const fields = {
      tip_instalatie: form.tip_instalatie.trim() || null,
      tip_penetrare_dinamica: form.tip_penetrare_dinamica.trim() || null,
      intocmit: form.intocmit.trim() || null,
      final_depth: form.final_depth.trim() || null,
      kilometraj: form.kilometraj.trim() || null,
      elevation_h: form.elevation_h.trim() || null,
      lat: isNaN(lat) ? point.lat : lat,
      lng: isNaN(lng) ? point.lng : lng,
      notes: form.notes.trim() || null,
    };

    if (isOffline) {
      await addPendingDrillPointFields(point.id, fields);
      setDateForajMessage({ type: "success", text: "Salvat local. Se va sincroniza automat la revenirea online." });
      setTimeout(() => setDateForajMessage(null), 4000);
    } else {
      const { data, error } = await supabase
        .from("drill_points")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", point.id)
        .select("id");
      if (error) {
        setDateForajMessage({ type: "error", text: error.message });
      } else if (!data || data.length === 0) {
        setDateForajMessage({
          type: "error",
          text: "Salvarea nu a reușit (permisiuni insuficiente). Verifică dacă punctul e asignat echipei tale sau contactează admin.",
        });
      } else {
        setDateForajMessage({ type: "success", text: "Date foraj salvate." });
        setTimeout(() => setDateForajMessage(null), 3000);
        router.refresh();
      }
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-lg border shadow-sm p-4">
        <h2 className="font-semibold text-slate-800 mb-4">Date generale</h2>
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Cod
            </label>
            <p className="text-slate-800 font-mono">{point.code}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Status
            </label>
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                point.status === "de_facut"
                  ? "bg-blue-100 text-blue-800"
                  : point.status === "in_lucru"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-green-100 text-green-800"
              }`}
            >
              {STATUS_LABELS[point.status] ?? point.status}
            </span>
          </div>
          {point.assigned_team && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Echipă
              </label>
              <p className="text-slate-800">{point.assigned_team}</p>
            </div>
          )}
        </div>
      </section>

      <section className="bg-white rounded-lg border shadow-sm p-4">
        <h2 className="font-semibold text-slate-800 mb-4">
          Date foraj (Fișa Foraj)
        </h2>
        {dateForajMessage && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              dateForajMessage.type === "error"
                ? "bg-red-50 text-red-800 border border-red-200"
                : "bg-green-50 text-green-800 border border-green-200"
            }`}
          >
            {dateForajMessage.text}
          </div>
        )}
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Tip instalație
            </label>
            <select
              value={form.tip_instalatie}
              onChange={(e) =>
                setForm((f) => ({ ...f, tip_instalatie: e.target.value }))
              }
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">— Selectează —</option>
              {TIP_INSTALATIE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Tip penetrare dinamică
            </label>
            <select
              value={form.tip_penetrare_dinamica}
              onChange={(e) =>
                setForm((f) => ({ ...f, tip_penetrare_dinamica: e.target.value }))
              }
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">— Foraj standard (litologie, probe, etc.) —</option>
              {TIP_PENETRARE_DINAMICA_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} {opt === "DPSH" ? "(interval 20 cm)" : "(interval 10 cm)"}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Dacă selectezi DPSH (20 cm) sau DPM/DPL/DPH (10 cm), după Date foraj apare rubrica Penetrare dinamică, apoi Poze și Export PDF/ZIP.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Întocmit
            </label>
            <input
              type="text"
              value={form.intocmit}
              onChange={(e) =>
                setForm((f) => ({ ...f, intocmit: e.target.value }))
              }
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Nume specialist"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Adâncime foraj h (m) – din CSV
            </label>
            <input
              type="text"
              value={form.elevation_h}
              onChange={(e) =>
                setForm((f) => ({ ...f, elevation_h: e.target.value }))
              }
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Adâncime din coloana h"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Adâncime finală (m)
            </label>
            <input
              type="text"
              value={form.final_depth}
              onChange={(e) =>
                setForm((f) => ({ ...f, final_depth: e.target.value }))
              }
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="ex: 12.5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Kilometraj (km)
            </label>
            <input
              type="text"
              value={form.kilometraj}
              onChange={(e) =>
                setForm((f) => ({ ...f, kilometraj: e.target.value }))
              }
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="ex: DJ674 km 12+350"
            />
          </div>

          {/* Coordonate */}
          <div className="border-t border-slate-200 pt-4 mt-2">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Coordonate</h3>
            <p className="text-xs text-slate-500 mb-3">
              Valorile din CSV sunt de la proiectant. Pe teren poziția poate diferi (ex. 20 m). Preia coordonatele noi de unde te afli efectiv.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Latitudine</label>
                <input
                  type="text"
                  value={form.lat}
                  onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  placeholder="ex: 44.6280"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Longitudine</label>
                <input
                  type="text"
                  value={form.lng}
                  onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  placeholder="ex: 23.8521"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!navigator.geolocation) {
                  alert("Geolocația nu este disponibilă în acest browser.");
                  return;
                }
                setGettingLocation(true);
                navigator.geolocation.getCurrentPosition(
                  async (pos) => {
                    const newLat = parseFloat(pos.coords.latitude.toFixed(6));
                    const newLng = parseFloat(pos.coords.longitude.toFixed(6));
                    setForm((f) => ({
                      ...f,
                      lat: String(newLat),
                      lng: String(newLng),
                    }));
                    setSaving(true);
                    setGettingLocation(false);
                    if (isOffline) {
                      await addPendingDrillPointFields(point.id, { lat: newLat, lng: newLng });
                      setDateForajMessage({ type: "success", text: "Coordonate salvate local. Se vor sincroniza la revenirea online." });
                      setTimeout(() => setDateForajMessage(null), 3000);
                    } else {
                      const { error } = await supabase
                        .from("drill_points")
                        .update({
                          lat: newLat,
                          lng: newLng,
                          updated_at: new Date().toISOString(),
                        })
                        .eq("id", point.id);
                      if (error) {
                        alert(`Eroare salvare: ${error.message}`);
                      } else {
                        router.refresh();
                      }
                    }
                    setSaving(false);
                  },
                  (err) => {
                    alert(`Eroare preluare coordonate: ${err.message}`);
                    setGettingLocation(false);
                  },
                  { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                );
              }}
              disabled={gettingLocation}
              className="mt-3 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50 flex items-center gap-2"
            >
              📍 {gettingLocation ? "Se preiau..." : "Preia poziția actuală (unde te afli la foraj)"}
            </button>
          </div>

          {/* Observații */}
          <div className="border-t border-slate-200 pt-4 mt-2">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Observații</h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Observații</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Note suplimentare"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveDateForaj}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Se salvează..." : "Salvează Date foraj"}
          </button>
          <span className="text-xs text-slate-500">Apasă pentru a salva cu siguranță.</span>
        </div>
      </section>

      {isOffline && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <strong>Mod offline.</strong> Toate secțiunile se salvează local și se sincronizează automat la revenirea online.
        </div>
      )}

      {["DPSH", "DPM", "DPL", "DPH"].includes(form.tip_penetrare_dinamica) ? (
        <>
          <section className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <p className="text-sm font-medium text-blue-900">
              Fișă foraj – penetrare dinamică ({form.tip_penetrare_dinamica}). După Date foraj urmează rubrica Penetrare dinamică (interval bătăi: {form.tip_penetrare_dinamica === "DPSH" ? "20 cm" : "10 cm"}).
            </p>
          </section>
          <DynamicPenetrationSection
            drillPointId={point.id}
            tip={form.tip_penetrare_dinamica as "DPSH" | "DPM" | "DPL" | "DPH"}
            finalDepth={finalDepth}
            initialData={detail?.dynamicPenetration}
            isOffline={isOffline}
          />
          <PhotoSection
            drillPointId={point.id}
            initialPhotos={detail?.boreholePhotos}
            isOffline={isOffline}
          />
          <ExportSection
            point={{ ...point, tip_penetrare_dinamica: form.tip_penetrare_dinamica || null }}
            project={project ?? null}
            detail={detail ?? null}
            isOffline={isOffline}
          />
        </>
      ) : (
        <>
      <LithologySection
        drillPointId={point.id}
        finalDepth={finalDepth}
        initialData={detail?.lithology}
        isOffline={isOffline}
      />

      <SamplesSection
        drillPointId={point.id}
        finalDepth={finalDepth}
        initialData={detail?.samples}
        isOffline={isOffline}
        onSamplesChange={() => setSamplesRefreshKey((k) => k + 1)}
      />

      <NivelApaSection
        drillPointId={point.id}
        waterDuring={point.water_during ?? null}
        waterAfter24h={point.water_after_24h ?? null}
        finalDepth={finalDepth}
        refreshKey={samplesRefreshKey}
        initialData={detail ? { samples: detail.samples } : undefined}
        isOffline={isOffline}
      />

      <EquipmentSection
        drillPointId={point.id}
        finalDepth={finalDepth}
        initialData={detail?.equipment}
        isOffline={isOffline}
      />

      <PocketPenetrometerSection
        drillPointId={point.id}
        finalDepth={finalDepth}
        initialData={detail?.pocketPenetrometer}
        isOffline={isOffline}
      />

      <PocketVaneTestSection
        drillPointId={point.id}
        finalDepth={finalDepth}
        initialData={detail?.pocketVaneTest}
        isOffline={isOffline}
      />

      <RqdTcrScrSection
        drillPointId={point.id}
        finalDepth={finalDepth}
        initialData={detail?.rqdTcrScr}
        isOffline={isOffline}
      />

      <PhotoSection
        drillPointId={point.id}
        initialPhotos={detail?.boreholePhotos}
        isOffline={isOffline}
      />

      <ExportSection
        point={point}
        project={project ?? null}
        detail={detail ?? null}
        isOffline={isOffline}
      />
        </>
      )}

      <p className="text-xs text-slate-500">
        VST va fi adăugat în fazele următoare.
      </p>
    </div>
  );
}
