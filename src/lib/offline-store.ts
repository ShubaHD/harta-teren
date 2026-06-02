import Dexie, { type Table } from "dexie";
import type {
  DrillPoint,
  LithologyInterval,
  Sample,
  Equipment,
  PocketPenetrometer,
  PocketVaneTest,
  RqdTcrScr,
  BoreholePhoto,
  DynamicPenetrationInterval,
} from "./types";
import { log } from "./offline/offlineLogger";

export interface CachedPoints {
  projectId: string;
  points: DrillPoint[];
  updatedAt: number;
}

export interface CachedProfile {
  id: "profile";
  userId: string;
  teamName: string | null;
  isAdmin: boolean;
  updatedAt: number;
}

export interface PendingUpdate {
  id?: number;
  pointId: string;
  projectId: string;
  action: "claim" | "complete";
  teamName: string | null;
  userId: string;
  finalDepth: string | null;
  createdAt: number;
}

/** Cache complet Fișă foraj pentru un punct */
export interface CachedDrillPointDetail {
  drillPointId: string;
  point: DrillPoint;
  lithology: LithologyInterval[];
  samples: Sample[];
  equipment: Equipment[];
  pocketPenetrometer: PocketPenetrometer[];
  pocketVaneTest: PocketVaneTest[];
  rqdTcrScr: RqdTcrScr[];
  boreholePhotos: BoreholePhoto[];
  dynamicPenetration?: DynamicPenetrationInterval[];
  updatedAt: number;
}

/** Actualizare pending pentru Date foraj (drill_points) */
export interface PendingDrillPointFields {
  id?: number;
  drillPointId: string;
  fields: {
    tip_instalatie?: string | null;
    intocmit?: string | null;
    final_depth?: string | null;
    kilometraj?: string | null;
    elevation_h?: string | null;
    lat?: number;
    lng?: number;
    notes?: string | null;
    water_during?: string | null;
    water_after_24h?: string | null;
    tip_penetrare_dinamica?: string | null;
  };
  createdAt: number;
}

/** Poză adăugată offline – blob salvat local, upload la sync */
export interface PendingPhoto {
  id?: number;
  drillPointId: string;
  title: string;
  rotation: number;
  blob: Blob;
  tempId: string;
  createdAt: number;
}

/** Operație generică pentru tabele copil */
export interface PendingFormOp {
  id?: number;
  drillPointId: string;
  table: "lithology_intervals" | "samples" | "equipment" | "pocket_penetrometer" | "pocket_vane_test" | "rqd_tcr_scr" | "borehole_photos" | "dynamic_penetration_intervals";
  action: "insert" | "update" | "delete";
  recordId?: string;
  data?: Record<string, unknown>;
  createdAt: number;
}

class OfflineStore extends Dexie {
  pointsCache!: Table<CachedPoints, string>;
  profileCache!: Table<CachedProfile, string>;
  pendingUpdates!: Table<PendingUpdate, number>;
  drillPointDetailCache!: Table<CachedDrillPointDetail, string>;
  pendingDrillPointFields!: Table<PendingDrillPointFields, number>;
  pendingFormOps!: Table<PendingFormOp, number>;
  pendingPhotos!: Table<PendingPhoto, number>;

  constructor() {
    super("HartaTerenOffline");
    this.version(4).stores({
      pointsCache: "projectId",
      profileCache: "id",
      pendingUpdates: "++id,pointId,projectId",
      drillPointDetailCache: "drillPointId",
      pendingDrillPointFields: "++id,drillPointId",
      pendingFormOps: "++id,drillPointId,table",
      pendingPhotos: "++id,drillPointId,createdAt",
    });
  }
}

export const db = new OfflineStore();

export async function cachePoints(projectId: string, points: DrillPoint[]) {
  await db.pointsCache.put({
    projectId,
    points,
    updatedAt: Date.now(),
  });
  log("idb:write", "cachePoints", { projectId, count: points.length });
}

export async function getCachedPoints(projectId: string): Promise<DrillPoint[] | null> {
  const cached = await db.pointsCache.get(projectId);
  return cached?.points ?? null;
}

export async function cacheProfile(profile: { userId: string; teamName: string | null; isAdmin: boolean }) {
  await db.profileCache.put({
    id: "profile",
    ...profile,
    updatedAt: Date.now(),
  });
  log("idb:write", "cacheProfile", { userId: profile.userId });
}

export async function getCachedProfile(): Promise<CachedProfile | null> {
  const p = await db.profileCache.get("profile");
  return p ?? null;
}

export async function addPendingUpdate(update: Omit<PendingUpdate, "id" | "createdAt">) {
  await db.pendingUpdates.add({
    ...update,
    createdAt: Date.now(),
  } as PendingUpdate);
  log("idb:write", "addPendingUpdate", { pointId: update.pointId, action: update.action });
}

export async function getPendingUpdates(): Promise<PendingUpdate[]> {
  return db.pendingUpdates.toArray();
}

export async function removePendingUpdate(id: number) {
  await db.pendingUpdates.delete(id);
  log("idb:write", "removePendingUpdate", { id });
}

export function applyPendingToPoint(point: DrillPoint, update: PendingUpdate): DrillPoint {
  const copy = { ...point };
  if (update.action === "claim") {
    copy.status = "in_lucru";
    copy.assigned_team = update.teamName;
    copy.started_at = new Date().toISOString();
  } else {
    copy.status = "finalizat";
    copy.completed_at = new Date().toISOString();
    copy.final_depth = update.finalDepth;
  }
  copy.updated_at = new Date().toISOString();
  return copy;
}

export async function applyPendingToCachedPoints(
  projectId: string,
  points: DrillPoint[]
): Promise<DrillPoint[]> {
  const pending = await db.pendingUpdates.where("projectId").equals(projectId).toArray();
  if (pending.length === 0) return points;
  const byPoint = new Map(pending.map((p) => [p.pointId, p]));
  return points.map((pt) => {
    const u = byPoint.get(pt.id);
    return u ? applyPendingToPoint(pt, u) : pt;
  });
}

export async function applyOfflineUpdateAndCache(
  projectId: string,
  point: DrillPoint,
  update: Omit<PendingUpdate, "id" | "createdAt" | "projectId">
): Promise<void> {
  const fullUpdate: PendingUpdate = { ...update, projectId, id: 0, createdAt: Date.now() };
  await addPendingUpdate({ ...update, projectId });
  const cached = await getCachedPoints(projectId);
  if (cached) {
    const updated = cached.map((p) =>
      p.id === point.id ? applyPendingToPoint(p, fullUpdate) : p
    );
    await cachePoints(projectId, updated);
  }
}

// --- Fișă foraj offline ---

export async function cacheDrillPointDetail(
  detail: Omit<CachedDrillPointDetail, "updatedAt"> | CachedDrillPointDetail
) {
  await db.drillPointDetailCache.put({
    ...detail,
    updatedAt: Date.now(),
  });
  log("idb:write", "cacheDrillPointDetail", { drillPointId: detail.drillPointId });
}

export async function getCachedDrillPointDetail(drillPointId: string): Promise<CachedDrillPointDetail | null> {
  const cached = await db.drillPointDetailCache.get(drillPointId);
  return cached ? cached : null;
}

export async function addPendingDrillPointFields(
  drillPointId: string,
  fields: PendingDrillPointFields["fields"]
) {
  const existing = await db.pendingDrillPointFields.where("drillPointId").equals(drillPointId).first();
  if (existing) {
    await db.pendingDrillPointFields.update(existing.id!, {
      fields: { ...existing.fields, ...fields },
      createdAt: Date.now(),
    });
  } else {
    await db.pendingDrillPointFields.add({
      drillPointId,
      fields,
      createdAt: Date.now(),
    });
  }
  log("idb:write", "addPendingDrillPointFields", { drillPointId });
}

export async function getPendingDrillPointFields(drillPointId: string): Promise<PendingDrillPointFields | null> {
  const p = await db.pendingDrillPointFields.where("drillPointId").equals(drillPointId).first();
  return p ?? null;
}

export async function getAllPendingDrillPointFields(): Promise<PendingDrillPointFields[]> {
  return db.pendingDrillPointFields.toArray();
}

export async function removePendingDrillPointFields(id: number) {
  await db.pendingDrillPointFields.delete(id);
  log("idb:write", "removePendingDrillPointFields", { id });
}

export async function addPendingFormOp(op: Omit<PendingFormOp, "id" | "createdAt">) {
  await db.pendingFormOps.add({
    ...op,
    createdAt: Date.now(),
  } as PendingFormOp);
  log("idb:write", "addPendingFormOp", { drillPointId: op.drillPointId, table: op.table, action: op.action });
}

export async function getPendingFormOps(drillPointId: string): Promise<PendingFormOp[]> {
  return db.pendingFormOps.where("drillPointId").equals(drillPointId).toArray();
}

export async function getAllPendingFormOps(): Promise<PendingFormOp[]> {
  return db.pendingFormOps.toArray();
}

export async function removePendingFormOp(id: number) {
  await db.pendingFormOps.delete(id);
  log("idb:write", "removePendingFormOp", { id });
}

// --- Pending Photos (offline) ---

export async function addPendingPhoto(photo: Omit<PendingPhoto, "id" | "createdAt">) {
  await db.pendingPhotos.add({
    ...photo,
    createdAt: Date.now(),
  } as PendingPhoto);
  log("idb:write", "addPendingPhoto", { drillPointId: photo.drillPointId });
}

export async function getPendingPhotos(drillPointId: string): Promise<PendingPhoto[]> {
  return db.pendingPhotos.where("drillPointId").equals(drillPointId).toArray();
}

export async function getAllPendingPhotos(): Promise<PendingPhoto[]> {
  return db.pendingPhotos.toArray();
}

export async function removePendingPhoto(id: number) {
  await db.pendingPhotos.delete(id);
  log("idb:write", "removePendingPhoto", { id });
}

export async function updatePendingPhotoRotation(drillPointId: string, tempId: string, rotation: number) {
  const p = await db.pendingPhotos.where("drillPointId").equals(drillPointId).filter((x) => x.tempId === tempId).first();
  if (p?.id != null) await db.pendingPhotos.update(p.id, { rotation });
}

/** Aplică operațiile pending pe lista de înregistrări (pentru afișare offline) */
export function applyPendingFormOpsToRecords<T extends { id: string }>(
  records: T[],
  pending: PendingFormOp[],
  table: PendingFormOp["table"]
): T[] {
  const tablePending = pending.filter((p) => p.table === table);
  let result = [...records];
  for (const op of tablePending) {
    if (op.action === "insert" && op.data) {
      const tempId = (op.recordId || op.data?.id as string) ?? crypto.randomUUID();
      result.push({ ...op.data, id: tempId } as T);
    } else if (op.action === "update" && op.recordId && op.data) {
      result = result.map((r) =>
        r.id === op.recordId ? { ...r, ...op.data } as T : r
      );
    } else if (op.action === "delete" && op.recordId) {
      result = result.filter((r) => r.id !== op.recordId);
    }
  }
  return result;
}
