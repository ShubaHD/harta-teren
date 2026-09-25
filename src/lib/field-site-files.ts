import type { SupabaseClient } from "@supabase/supabase-js";
import { findExistingPointByCode } from "./csv-import";
import type { FieldSiteFile } from "./types";

export const FIELD_SITE_BUCKET = "field-site-files";

export type FieldSiteIndexEntry = {
  hasPdf: boolean;
};

export function getFieldSitePublicUrl(
  supabase: SupabaseClient,
  storagePath: string
): string {
  return supabase.storage.from(FIELD_SITE_BUCKET).getPublicUrl(storagePath).data
    .publicUrl;
}

export function isPdfFile(file: File): boolean {
  if (file.type === "application/pdf") return true;
  return extensionOf(file.name) === "pdf";
}

export function fileRelativePath(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return rel && rel.length > 0 ? rel : file.name;
}

/**
 * Foraj_FI_64+880.pdf → FI64+880
 * Foraj_Fl_70+860.pdf → FI70+860 (L vs I)
 * Foraj_FP-68+070.pdf → FP68+070 (cratimă)
 * Foraj_FP_68+295_Test_Presiometrie.pdf → FP68+295
 */
export function matchPathToPoint<T extends { id: string; code: string }>(
  path: string,
  points: T[]
): T | null {
  const byNorm = new Map<string, T>();
  for (const point of points) {
    const n = normalizePdfCode(point.code);
    if (n && !byNorm.has(n)) byNorm.set(n, point);
  }

  const fileBase = (path.split(/[/\\]/).pop() || path).replace(/\.[^.]+$/i, "");
  const withoutForaj = fileBase.replace(/^foraj[_-\s]*/i, "");
  const tokens = [withoutForaj, fileBase, ...extractCodesFromPath(path)];

  for (const token of tokens) {
    const n = normalizePdfCode(token);
    const found = lookupPdfCode(byNorm, n);
    if (found) return found;
    const byFind = findExistingPointByCode(points, token);
    if (byFind) return byFind;
  }

  const haystack = normalizePdfCode(path.replace(/foraj/gi, ""));
  const sorted = [...byNorm.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [code, point] of sorted) {
    if (code.length < 4) continue;
    if (haystack.includes(code)) return point;
  }
  return null;
}

export function buildFieldSiteIndex(
  rows: { drill_point_id: string }[]
): Map<string, FieldSiteIndexEntry> {
  const map = new Map<string, FieldSiteIndexEntry>();
  for (const row of rows) {
    map.set(row.drill_point_id, { hasPdf: true });
  }
  return map;
}

export async function downloadFromUrl(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Nu s-a putut descărca fișierul.");
  const blob = await res.blob();
  const obj = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = obj;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(obj);
}

export function sanitizeStorageName(filename: string): string {
  const base = filename.split(/[/\\]/).pop() || "fisier";
  return base.replace(/[<>:"|?*]/g, "_").replace(/\s+/g, "_").slice(0, 120);
}

export async function uploadFieldSitePdf(
  supabase: SupabaseClient,
  drillPointId: string,
  file: File
): Promise<{ error: string | null }> {
  const { data: existing } = await supabase
    .from("field_site_files")
    .select("id, storage_path")
    .eq("drill_point_id", drillPointId)
    .maybeSingle();
  if (existing?.storage_path) {
    await supabase.storage.from(FIELD_SITE_BUCKET).remove([existing.storage_path]);
    await supabase.from("field_site_files").delete().eq("id", existing.id);
  }

  const filename = sanitizeStorageName(file.name);
  const storagePath = `${drillPointId}/pdf/${crypto.randomUUID()}_${filename}`;
  const { error: uploadErr } = await supabase.storage
    .from(FIELD_SITE_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || "application/pdf",
      upsert: false,
    });
  if (uploadErr) return { error: uploadErr.message };

  const { error: insertErr } = await supabase.from("field_site_files").insert({
    drill_point_id: drillPointId,
    kind: "pdf",
    filename,
    storage_path: storagePath,
  });
  if (insertErr) {
    await supabase.storage.from(FIELD_SITE_BUCKET).remove([storagePath]);
    return { error: insertErr.message };
  }
  return { error: null };
}

export async function deleteFieldSiteFile(
  supabase: SupabaseClient,
  file: Pick<FieldSiteFile, "id" | "storage_path">
): Promise<{ error: string | null }> {
  const { error: storageErr } = await supabase.storage
    .from(FIELD_SITE_BUCKET)
    .remove([file.storage_path]);
  if (storageErr) return { error: storageErr.message };
  const { error } = await supabase.from("field_site_files").delete().eq("id", file.id);
  return { error: error?.message ?? null };
}

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function extractCodesFromPath(path: string): string[] {
  const cleaned = path.replace(/foraj[_-\s]*/gi, "");
  return [...cleaned.matchAll(/[A-Za-z]{1,4}[_-\s]?\d+\+\d+/g)].map((m) => m[0]);
}

/** Ignoră spații, _ și - ; Fl70+860 (L) se încearcă și ca FI70+860. */
function normalizePdfCode(raw: string): string {
  return raw.trim().replace(/[\s_\-]+/g, "").toUpperCase();
}

function lookupPdfCode<T>(byNorm: Map<string, T>, n: string): T | undefined {
  if (!n) return undefined;
  const direct = byNorm.get(n);
  if (direct) return direct;
  if (n.startsWith("FL") && /^\d/.test(n.slice(2))) {
    return byNorm.get("FI" + n.slice(2));
  }
  return undefined;
}
