"use client";

import { createClient } from "@/lib/supabase/client";
import { getPendingPhotos } from "@/lib/offline-store";
import type { ExportPhoto } from "@/lib/export-foraj";
import type { BoreholePhoto } from "@/lib/types";

const BUCKET = "borehole-photos";

/** Rezolvă pozele pentru export: pending (offline) + boreholePhotos din Supabase Storage */
export async function resolvePhotosForExport(
  drillPointId: string,
  boreholePhotos: BoreholePhoto[],
  options?: { isOffline?: boolean }
): Promise<ExportPhoto[]> {
  const result: ExportPhoto[] = [];

  const pending = await getPendingPhotos(drillPointId);
  for (const p of pending) {
    result.push({
      title: p.title,
      blob: p.blob,
      rotation: p.rotation,
    });
  }

  if (boreholePhotos.length > 0 && !options?.isOffline) {
    const supabase = createClient();
    for (const bp of boreholePhotos) {
      try {
        const { data } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(bp.storage_path);
        const res = await fetch(data.publicUrl);
        if (res.ok) {
          const blob = await res.blob();
          result.push({
            title: bp.title,
            blob,
            rotation: bp.rotation,
          });
        }
      } catch {
        // Skip failed fetches (e.g. CORS, network)
      }
    }
  }

  return result;
}
