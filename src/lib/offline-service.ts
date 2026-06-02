"use client";

import type { DrillPoint } from "./types";
import type { CachedProfile, PendingUpdate } from "./offline-store";
import {
  getCachedPoints,
  cachePoints,
  applyPendingToCachedPoints,
  getCachedProfile,
  cacheProfile,
  addPendingUpdate,
  getPendingUpdates,
  applyOfflineUpdateAndCache,
} from "./offline-store";
import { syncPendingUpdates } from "./offline-sync";
import { isOnline as getOfflineStatus } from "./offline/offlineStatus";

/** Sursa unică pentru starea rețelei (navigator.onLine + probe, via offlineStatus). */
export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return getOfflineStatus();
}

/** Profil pentru offline (userId + teamName). */
export interface OfflineProfile {
  userId: string;
  teamName: string | null;
  isAdmin: boolean;
}

/** Salvează profilul în cache – apelat la login și la încărcarea hărții. */
export async function saveProfileForOffline(profile: OfflineProfile): Promise<void> {
  await cacheProfile(profile);
}

/** Citește profilul din cache (pentru acțiuni offline). */
export async function getProfileForOffline(): Promise<CachedProfile | null> {
  return getCachedProfile();
}

/** Puncte pentru un proiect din cache, cu pending aplicat. Toate statusurile (inclusiv finalizat) pentru hartă. */
export async function getPointsForProjectOffline(
  projectId: string,
  _isAdmin: boolean
): Promise<DrillPoint[] | null> {
  const cached = await getCachedPoints(projectId);
  if (!cached) return null;
  return applyPendingToCachedPoints(projectId, cached);
}

/** Salvează punctele în cache (după fetch de pe server). */
export async function savePointsForOffline(projectId: string, points: DrillPoint[]): Promise<void> {
  await cachePoints(projectId, points);
}

/** Enqueue + aplică local (În lucru / Finalizat offline). */
export async function applyStatusUpdateOffline(
  projectId: string,
  point: DrillPoint,
  update: Omit<PendingUpdate, "id" | "createdAt" | "projectId">
): Promise<void> {
  await applyOfflineUpdateAndCache(projectId, point, update);
}

/** Număr de actualizări în așteptare. */
export async function getPendingUpdatesCount(): Promise<number> {
  const list = await getPendingUpdates();
  return list.length;
}

/** Sincronizează toate actualizările pending cu serverul; la succes reîmprospătează cache-ul. */
export async function syncPendingWithServer(): Promise<{ synced: number; failed: number }> {
  return syncPendingUpdates();
}
