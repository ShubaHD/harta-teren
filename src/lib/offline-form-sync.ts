"use client";

import { createClient } from "@/lib/supabase/client";
import { compressImageIfNeeded } from "@/lib/compress-image";
import {
  getAllPendingDrillPointFields,
  removePendingDrillPointFields,
  getAllPendingFormOps,
  removePendingFormOp,
  getAllPendingPhotos,
  removePendingPhoto,
  cacheDrillPointDetail,
} from "./offline-store";
import type { CachedDrillPointDetail } from "./offline-store";

const BUCKET = "borehole-photos";

export async function syncPendingFormUpdates(): Promise<{
  drillPointFields: number;
  formOps: number;
  photos: number;
  failed: number;
}> {
  const supabase = createClient();
  let drillPointFields = 0;
  let formOps = 0;
  let photos = 0;
  let failed = 0;
  const syncedDrillPointIds = new Set<string>();

  const pendingFields = await getAllPendingDrillPointFields();
  for (const p of pendingFields) {
    try {
      const { data, error } = await supabase
        .from("drill_points")
        .update({
          ...p.fields,
          updated_at: new Date().toISOString(),
        })
        .eq("id", p.drillPointId)
        .select("id");
      if (error || !data?.length) {
        failed++;
        continue;
      }
      if (p.id != null) await removePendingDrillPointFields(p.id);
      syncedDrillPointIds.add(p.drillPointId);
      drillPointFields++;
    } catch {
      failed++;
    }
  }

  const pendingOps = await getAllPendingFormOps();
  for (const op of pendingOps) {
    try {
      if (op.action === "insert" && op.data) {
        const insertData = { ...op.data };
        delete (insertData as Record<string, unknown>).id;
        const { error } = await supabase
          .from(op.table)
          .insert(insertData)
          .select()
          .single();
        if (error) {
          failed++;
          continue;
        }
      } else if (op.action === "update" && op.recordId && op.data) {
        const updateData: Record<string, unknown> = { ...op.data, updated_at: new Date().toISOString() };
        if (op.table === "borehole_photos" && typeof (op.data as { rotation?: number }).rotation === "number") {
          const r = ((op.data as { rotation: number }).rotation % 360 + 360) % 360;
          updateData.rotation = [0, 90, 180, 270].reduce((a, b) =>
            Math.abs(r - a) < Math.abs(r - b) ? a : b
          );
        }
        const { error } = await supabase
          .from(op.table)
          .update(updateData)
          .eq("id", op.recordId);
        if (error) {
          failed++;
          continue;
        }
      } else if (op.action === "delete" && op.recordId) {
        if (op.table === "borehole_photos") {
          const { data: photo } = await supabase
            .from("borehole_photos")
            .select("storage_path")
            .eq("id", op.recordId)
            .single();
          if (photo?.storage_path) {
            await supabase.storage.from(BUCKET).remove([photo.storage_path]);
          }
        }
        const { error } = await supabase.from(op.table).delete().eq("id", op.recordId);
        if (error) {
          failed++;
          continue;
        }
      }
      if (op.id != null) await removePendingFormOp(op.id);
      syncedDrillPointIds.add(op.drillPointId);
      formOps++;
    } catch {
      failed++;
    }
  }

  const pendingPhotosList = await getAllPendingPhotos();
  for (const pp of pendingPhotosList) {
    try {
      const toUpload = await compressImageIfNeeded(pp.blob);
      const ext = toUpload instanceof Blob && !(toUpload instanceof File)
        ? "jpg"
        : (pp.blob.type?.split("/")[1] || "jpg");
      const storagePath = `${pp.drillPointId}/${crypto.randomUUID()}.${ext}`;
      const opts = { upsert: false } as { upsert: boolean; contentType?: string };
      if (toUpload instanceof Blob && !(toUpload instanceof File)) opts.contentType = "image/jpeg";
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, toUpload, opts);
      if (uploadErr) {
        failed++;
        continue;
      }
      const r = ((pp.rotation % 360) + 360) % 360;
      const rotation = [0, 90, 180, 270].reduce((a, b) => (Math.abs(r - a) < Math.abs(r - b) ? a : b));
      const { error: insertErr } = await supabase.from("borehole_photos").insert({
        drill_point_id: pp.drillPointId,
        title: pp.title,
        storage_path: storagePath,
        rotation,
        updated_at: new Date().toISOString(),
      });
      if (insertErr) {
        failed++;
        continue;
      }
      if (pp.id != null) await removePendingPhoto(pp.id);
      syncedDrillPointIds.add(pp.drillPointId);
      photos++;
    } catch {
      failed++;
    }
  }

  // Reîmprospătează cache-ul pentru fișele sincronizate (afișare corectă la revenire pe fișă)
  if (syncedDrillPointIds.size > 0) {
    Promise.all(
      [...syncedDrillPointIds].map((id) => fetchAndCacheDrillPointDetail(id).catch(() => null))
    ).catch(() => {});
  }

  return { drillPointFields, formOps, photos, failed };
}

export async function fetchAndCacheDrillPointDetail(
  drillPointId: string
): Promise<CachedDrillPointDetail | null> {
  const supabase = createClient();

  const { data: point, error: pointErr } = await supabase
    .from("drill_points")
    .select("*")
    .eq("id", drillPointId)
    .single();
  if (pointErr || !point) return null;

  const [litho, samples, equip, penetro, vane, rqd, photos, dynPen] = await Promise.all([
    supabase.from("lithology_intervals").select("*").eq("drill_point_id", drillPointId).order("from_m"),
    supabase.from("samples").select("*").eq("drill_point_id", drillPointId).order("depth_m"),
    supabase.from("equipment").select("*").eq("drill_point_id", drillPointId).order("from_m"),
    supabase.from("pocket_penetrometer").select("*").eq("drill_point_id", drillPointId).order("from_m"),
    supabase.from("pocket_vane_test").select("*").eq("drill_point_id", drillPointId).order("from_m"),
    supabase.from("rqd_tcr_scr").select("*").eq("drill_point_id", drillPointId).order("from_m"),
    supabase.from("borehole_photos").select("*").eq("drill_point_id", drillPointId).order("created_at"),
    supabase.from("dynamic_penetration_intervals").select("*").eq("drill_point_id", drillPointId).order("from_m"),
  ]);

  const detail: CachedDrillPointDetail = {
    drillPointId,
    point: point as CachedDrillPointDetail["point"],
    lithology: (litho.data ?? []) as CachedDrillPointDetail["lithology"],
    samples: (samples.data ?? []) as CachedDrillPointDetail["samples"],
    equipment: (equip.data ?? []) as CachedDrillPointDetail["equipment"],
    pocketPenetrometer: (penetro.data ?? []) as CachedDrillPointDetail["pocketPenetrometer"],
    pocketVaneTest: (vane.data ?? []) as CachedDrillPointDetail["pocketVaneTest"],
    rqdTcrScr: (rqd.data ?? []) as CachedDrillPointDetail["rqdTcrScr"],
    boreholePhotos: (photos.data ?? []) as CachedDrillPointDetail["boreholePhotos"],
    dynamicPenetration: (dynPen.data ?? []) as CachedDrillPointDetail["dynamicPenetration"],
    updatedAt: Date.now(),
  };

  await cacheDrillPointDetail(detail);
  return detail;
}
