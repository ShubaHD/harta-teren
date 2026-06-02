/**
 * IndexedDB layer (modular db.js).
 * Re-exports offline-store; logging is done in offline-store via offlineLogger.
 */

import * as store from "@/lib/offline-store";

export type {
  CachedPoints,
  CachedProfile,
  PendingUpdate,
  CachedDrillPointDetail,
  PendingDrillPointFields,
  PendingPhoto,
  PendingFormOp,
} from "@/lib/offline-store";

export const db = store.db;

export const cachePoints = store.cachePoints;
export const getCachedPoints = store.getCachedPoints;
export const cacheProfile = store.cacheProfile;
export const getCachedProfile = store.getCachedProfile;
export const addPendingUpdate = store.addPendingUpdate;
export const getPendingUpdates = store.getPendingUpdates;
export const removePendingUpdate = store.removePendingUpdate;
export const applyPendingToPoint = store.applyPendingToPoint;
export const applyPendingToCachedPoints = store.applyPendingToCachedPoints;
export const applyOfflineUpdateAndCache = store.applyOfflineUpdateAndCache;
export const cacheDrillPointDetail = store.cacheDrillPointDetail;
export const getCachedDrillPointDetail = store.getCachedDrillPointDetail;
export const addPendingDrillPointFields = store.addPendingDrillPointFields;
export const getPendingDrillPointFields = store.getPendingDrillPointFields;
export const getAllPendingDrillPointFields = store.getAllPendingDrillPointFields;
export const removePendingDrillPointFields = store.removePendingDrillPointFields;
export const addPendingFormOp = store.addPendingFormOp;
export const getPendingFormOps = store.getPendingFormOps;
export const getAllPendingFormOps = store.getAllPendingFormOps;
export const removePendingFormOp = store.removePendingFormOp;
export const addPendingPhoto = store.addPendingPhoto;
export const getPendingPhotos = store.getPendingPhotos;
export const getAllPendingPhotos = store.getAllPendingPhotos;
export const removePendingPhoto = store.removePendingPhoto;
export const updatePendingPhotoRotation = store.updatePendingPhotoRotation;
export const applyPendingFormOpsToRecords = store.applyPendingFormOpsToRecords;
