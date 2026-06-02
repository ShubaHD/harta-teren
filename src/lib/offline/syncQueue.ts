"use client";

/**
 * Sync queue: process pending writes when online, with retry and backoff.
 * Logs every attempt and result.
 */

import { syncPendingUpdates } from "@/lib/offline-sync";
import { syncPendingFormUpdates } from "@/lib/offline-form-sync";
import {
  getPendingUpdates,
  getAllPendingDrillPointFields,
  getAllPendingFormOps,
  getAllPendingPhotos,
} from "@/lib/offline-store";
import { log } from "./offlineLogger";

const MAX_ATTEMPTS = 5;
const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

export interface SyncResult {
  map: { synced: number; failed: number };
  form: { drillPointFields: number; formOps: number; photos: number; failed: number };
  attempt: number;
}

let isProcessing = false;
let attemptCount = 0;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffDelay(attempt: number): number {
  const d = INITIAL_DELAY_MS * Math.pow(2, attempt);
  return Math.min(d, MAX_DELAY_MS);
}

/**
 * Process the entire queue once: map pending updates + form pending (fields, ops, photos).
 * On partial failure, returns so caller can retry later with backoff.
 */
export async function processQueue(): Promise<SyncResult> {
  if (isProcessing) {
    log("sync:retry", "processQueue skipped (already running)", {});
    return { map: { synced: 0, failed: 0 }, form: { drillPointFields: 0, formOps: 0, photos: 0, failed: 0 }, attempt: attemptCount };
  }

  const [mapPending, drillFields, formOps, photos] = await Promise.all([
    getPendingUpdates(),
    getAllPendingDrillPointFields(),
    getAllPendingFormOps(),
    getAllPendingPhotos(),
  ]);

  const totalPending = mapPending.length + drillFields.length + formOps.length + photos.length;
  if (totalPending === 0) {
    log("sync:result", "processQueue nothing pending", { attempt: attemptCount });
    return { map: { synced: 0, failed: 0 }, form: { drillPointFields: 0, formOps: 0, photos: 0, failed: 0 }, attempt: attemptCount };
  }

  isProcessing = true;
  attemptCount += 1;
  const attempt = attemptCount;

  log("sync:retry", "processQueue start", { attempt, mapPending: mapPending.length, drillFields: drillFields.length, formOps: formOps.length, photos: photos.length });

  try {
    const mapResult = await syncPendingUpdates();
    log("sync:result", "map sync done", { synced: mapResult.synced, failed: mapResult.failed, attempt });

    const formResult = await syncPendingFormUpdates();
    log("sync:result", "form sync done", {
      drillPointFields: formResult.drillPointFields,
      formOps: formResult.formOps,
      photos: formResult.photos,
      failed: formResult.failed,
      attempt,
    });

    const result: SyncResult = {
      map: mapResult,
      form: formResult,
      attempt,
    };

    const totalFailed = mapResult.failed + formResult.failed;
    if (totalFailed > 0) {
      log("sync:retry", "some items failed, will retry with backoff", { totalFailed, attempt });
    }

    return result;
  } finally {
    isProcessing = false;
  }
}

/**
 * Process queue with exponential backoff retries until queue is empty or max attempts reached.
 * Call when connectivity returns. Returns last SyncResult.
 */
export async function processQueueWithRetry(): Promise<SyncResult | null> {
  let attempt = 0;
  let lastResult: SyncResult | null = null;
  while (attempt < MAX_ATTEMPTS) {
    const result = await processQueue();
    lastResult = result;
    const anyPending = (result.map.failed + result.form.failed) > 0;
    if (!anyPending) break;
    attempt += 1;
    const wait = backoffDelay(attempt);
    log("sync:retry", "backoff before next attempt", { attempt, waitMs: wait });
    await delay(wait);
  }
  return lastResult;
}

/**
 * Total count of pending (unsynced) items.
 */
export async function getPendingCount(): Promise<number> {
  const [mapPending, drillFields, formOps, photos] = await Promise.all([
    getPendingUpdates(),
    getAllPendingDrillPointFields(),
    getAllPendingFormOps(),
    getAllPendingPhotos(),
  ]);
  return mapPending.length + drillFields.length + formOps.length + photos.length;
}
