"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BoreholeDetailForm from "@/components/BoreholeDetailForm";
import type { DrillPoint } from "@/lib/types";
import type { Project } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import {
  getCachedDrillPointDetail,
  getPendingDrillPointFields,
  getPendingFormOps,
  getPendingPhotos,
} from "@/lib/offline-store";
import UnsyncedBadge from "@/components/UnsyncedBadge";
import type { CachedDrillPointDetail } from "@/lib/offline-store";
import { fetchAndCacheDrillPointDetail } from "@/lib/offline-form-sync";

interface ForajPageClientProps {
  drillPointId: string;
  initialPoint: DrillPoint | null;
  initialProject?: Project | null;
}

export default function ForajPageClient({
  drillPointId,
  initialPoint,
  initialProject = null,
}: ForajPageClientProps) {
  const [point, setPoint] = useState<DrillPoint | null>(initialPoint);
  const [project, setProject] = useState<Project | null>(initialProject ?? null);
  const [detail, setDetail] = useState<CachedDrillPointDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [hasUnsyncedForm, setHasUnsyncedForm] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOffline(!navigator.onLine);
    const onOffline = () => setIsOffline(true);
    const onOnline = () => setIsOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      if (navigator.onLine) {
        const d = await fetchAndCacheDrillPointDetail(drillPointId);
        if (d) {
          setDetail(d);
          setPoint(d.point);
        } else {
          const cached = await getCachedDrillPointDetail(drillPointId);
          if (cached) {
            setDetail(cached);
            let merged = { ...cached.point };
            const pending = await getPendingDrillPointFields(drillPointId);
            if (pending) merged = { ...merged, ...pending.fields } as DrillPoint;
            setPoint(merged);
          } else if (initialPoint) {
            setPoint(initialPoint);
          }
        }
      } else {
        const cached = await getCachedDrillPointDetail(drillPointId);
        if (cached) {
          setDetail(cached);
          let merged = { ...cached.point };
          const pending = await getPendingDrillPointFields(drillPointId);
          if (pending) merged = { ...merged, ...pending.fields } as DrillPoint;
          setPoint(merged);
        } else if (initialPoint) {
          setPoint(initialPoint);
        } else {
          setPoint(null);
        }
      }
      setLoading(false);
    }
    load();
  }, [drillPointId, initialPoint]);

  useEffect(() => {
    if (!drillPointId) return;
    (async () => {
      const [fields, ops, photos] = await Promise.all([
        getPendingDrillPointFields(drillPointId),
        getPendingFormOps(drillPointId),
        getPendingPhotos(drillPointId),
      ]);
      setHasUnsyncedForm(!!(fields || (ops && ops.length > 0) || (photos && photos.length > 0)));
    })();
  }, [drillPointId, detail]);


  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">Se încarcă fișa...</p>
      </div>
    );
  }

  const mapHref = (project?.id ?? point?.project_id)
    ? `/mapa?project=${project?.id ?? point?.project_id}`
    : "/mapa";
  // Offline: mergem la pagina noastră de fallback (~offline), nu la /mapa, ca să nu apară ecranul generic al browser-ului
  const backHref = isOffline ? "/~offline" : mapHref;

  if (!point) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <header className="bg-white border-b px-4 py-3 mb-4">
          {isOffline ? (
            <a
              href={backHref}
              onClick={(e) => { e.preventDefault(); window.location.href = backHref; }}
              className="text-slate-600 hover:text-slate-800 text-sm font-medium"
            >
              ← Înapoi la hartă
            </a>
          ) : (
            <Link href="/mapa" className="text-slate-600 hover:text-slate-800 text-sm font-medium">
              ← Înapoi la hartă
            </Link>
          )}
        </header>
        <div className="max-w-2xl mx-auto p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-800 font-medium">Fișa nu este disponibilă offline.</p>
          <p className="text-amber-700 text-sm mt-1">
            Deschide această fișă când ești online pentru a o putea folosi și offline.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-[2100] bg-white border-b px-4 py-3 flex items-center gap-4 shadow-sm safe-area-left safe-area-right">
        {isOffline ? (
          <a
            href={backHref}
            onClick={(e) => { e.preventDefault(); window.location.href = backHref; }}
            className="text-slate-600 hover:text-slate-800 text-sm font-medium shrink-0 min-h-[44px] inline-flex items-center touch-manipulation"
          >
            ← Înapoi la hartă
          </a>
        ) : (
          <Link
            href={mapHref}
            className="text-slate-600 hover:text-slate-800 text-sm font-medium shrink-0 min-h-[44px] inline-flex items-center touch-manipulation"
          >
            ← Înapoi la hartă
          </Link>
        )}
        <h1 className="font-semibold text-slate-800 truncate min-w-0">
          Fișă foraj: {point.code}
        </h1>
        {isOffline && (
          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded shrink-0">
            Offline
          </span>
        )}
        {hasUnsyncedForm && (
          <UnsyncedBadge label="Date nesincronizate" className="shrink-0" />
        )}
      </header>
      <main className="max-w-2xl mx-auto p-4">
        <BoreholeDetailForm
          point={point}
          project={project}
          detail={detail}
          isOffline={isOffline}
        />
      </main>
    </div>
  );
}
