"use client";

import { fetchAndCacheDrillPointDetail } from "./offline-form-sync";
import { getCachedDrillPointDetail } from "./offline-store";

const BATCH_SIZE = 3;
const DELAY_MS = 400;

export interface PrefetchProgress {
  total: number;
  done: number;
  failed: number;
}

const FORAJ_PAGES_CACHE = "foraj-pages";

/** Preîncarcă pagina în SW cache (document + RSC) și scrie explicit în Cache API ca navigarea offline să o găsească */
async function prefetchForajPage(drillPointId: string): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) return;
  const origin = window.location.origin;
  const path = `/foraj/${drillPointId}`;
  const docUrl = `${origin}${path}`;
  const docUrlWithSlash = `${origin}${path}/`;
  const opts: RequestInit = { credentials: "include", mode: "same-origin" };
  const docRequest = new Request(docUrl, opts);
  const docRequestSlash = new Request(docUrlWithSlash, opts);
  const rscRequest = new Request(docUrl, { ...opts, headers: { RSC: "1" } });
  const rscRequestSlash = new Request(docUrlWithSlash, { ...opts, headers: { RSC: "1" } });

  try {
    const [docRes, rscRes] = await Promise.all([
      fetch(docRequest),
      fetch(rscRequest),
    ]);
    const cache = await caches.open(FORAJ_PAGES_CACHE);
    if (docRes.ok && docRes.status === 200) {
      await cache.put(docRequest, docRes.clone());
      await cache.put(docRequestSlash, docRes.clone());
    }
    if (rscRes.ok && rscRes.status === 200) {
      await cache.put(rscRequest, rscRes.clone());
      await cache.put(rscRequestSlash, rscRes.clone());
    }
  } catch {
    // Rețea eșuată sau cache indisponibil – ignorăm
  }
}

/** Prefetch progresiv: date + pagină HTML pentru fiecare fișă */
async function prefetchSingleDrillPoint(id: string): Promise<boolean> {
  const dataOk = await fetchAndCacheDrillPointDetail(id);
  if (!dataOk) return false;
  await prefetchForajPage(id);
  return true;
}

/** Prefetch progresiv: 2-3 fișe odată, cu pauză între batch-uri */
export async function prefetchDrillPointDetails(
  pointIds: string[],
  onProgress?: (p: PrefetchProgress) => void
): Promise<{ done: number; failed: number }> {
  let done = 0;
  let failed = 0;
  const total = pointIds.length;

  for (let i = 0; i < pointIds.length; i += BATCH_SIZE) {
    const batch = pointIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((id) => prefetchSingleDrillPoint(id))
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) done++;
      else failed++;
    }
    onProgress?.({ total, done, failed });
    if (i + BATCH_SIZE < pointIds.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }
  return { done, failed };
}

/** Returnează ID-urile punctelor care nu au fișa în cache */
export async function getPointIdsMissingCache(pointIds: string[]): Promise<string[]> {
  const missing: string[] = [];
  for (const id of pointIds) {
    const cached = await getCachedDrillPointDetail(id);
    if (!cached) missing.push(id);
  }
  return missing;
}
