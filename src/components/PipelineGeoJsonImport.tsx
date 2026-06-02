"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import proj4 from "proj4";
// dxf-parser nu are types stabile; îl folosim ca any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import DxfParser from "dxf-parser";

type GeoJsonGeometry =
  | { type: "LineString"; coordinates: [number, number][] }
  | { type: "MultiLineString"; coordinates: [number, number][][] };

type GeoJsonFeature = {
  type: "Feature";
  geometry: GeoJsonGeometry | null;
  properties?: Record<string, unknown> | null;
};

type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

function isFeatureCollection(x: unknown): x is GeoJsonFeatureCollection {
  return (
    typeof x === "object" &&
    x !== null &&
    (x as { type?: unknown }).type === "FeatureCollection" &&
    Array.isArray((x as { features?: unknown }).features)
  );
}

function flattenLineGeometries(fc: GeoJsonFeatureCollection) {
  const lines: Array<{
    geom: { type: "LineString"; coordinates: [number, number][] };
    properties: Record<string, unknown>;
  }> = [];

  for (const f of fc.features) {
    if (!f || f.type !== "Feature") continue;
    const props = (f.properties && typeof f.properties === "object" ? f.properties : {}) as Record<string, unknown>;
    const g = f.geometry;
    if (!g) continue;

    if (g.type === "LineString") {
      if (Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
        lines.push({
          geom: { type: "LineString", coordinates: g.coordinates },
          properties: props,
        });
      }
      continue;
    }

    if (g.type === "MultiLineString") {
      for (const part of g.coordinates ?? []) {
        if (Array.isArray(part) && part.length >= 2) {
          lines.push({
            geom: { type: "LineString", coordinates: part },
            properties: props,
          });
        }
      }
    }
  }

  return lines;
}

function looksLikeLngLat(coord: [number, number]) {
  const [lng, lat] = coord;
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    Math.abs(lng) <= 180 &&
    Math.abs(lat) <= 90
  );
}

const EPSG_3844 =
  "+proj=sterea +lat_0=46 +lon_0=25 +k=0.99975 +x_0=500000 +y_0=500000 +ellps=krass +towgs84=28,-121,-77,0,0,0,0 +units=m +no_defs";

type ImportedLine = {
  geom: { type: "LineString"; coordinates: [number, number][] };
  properties: Record<string, unknown>;
};

function toLngLatFromStereo70(x: number, y: number): [number, number] {
  const [lng, lat] = proj4(EPSG_3844, "WGS84", [x, y]) as [number, number];
  return [lng, lat];
}

function importDxfToLines(text: string): ImportedLine[] {
  const parser = new (DxfParser as unknown as { new (): { parseSync: (t: string) => any } })();
  const dxf = parser.parseSync(text) as { entities?: any[] };
  const entities = dxf.entities ?? [];
  const lines: ImportedLine[] = [];

  for (const ent of entities) {
    if (!ent || typeof ent !== "object") continue;
    const layerName = typeof ent.layer === "string" ? ent.layer : undefined;
    const commonProps: Record<string, unknown> = layerName ? { layer: layerName } : {};

    // LINE: start/end
    if (ent.type === "LINE" && ent.start && ent.end) {
      const a = toLngLatFromStereo70(ent.start.x, ent.start.y);
      const b = toLngLatFromStereo70(ent.end.x, ent.end.y);
      if (looksLikeLngLat(a) && looksLikeLngLat(b)) {
        lines.push({
          geom: { type: "LineString", coordinates: [a, b] },
          properties: commonProps,
        });
      }
      continue;
    }

    // LWPOLYLINE / POLYLINE: vertices
    if ((ent.type === "LWPOLYLINE" || ent.type === "POLYLINE") && Array.isArray(ent.vertices)) {
      const coords: [number, number][] = [];
      for (const v of ent.vertices) {
        if (!v) continue;
        // LWPOLYLINE: v.x/v.y; POLYLINE: v.x/v.y de obicei
        const x = typeof v.x === "number" ? v.x : typeof v.location?.x === "number" ? v.location.x : null;
        const y = typeof v.y === "number" ? v.y : typeof v.location?.y === "number" ? v.location.y : null;
        if (x == null || y == null) continue;
        coords.push(toLngLatFromStereo70(x, y));
      }
      if (coords.length >= 2 && looksLikeLngLat(coords[0])) {
        lines.push({
          geom: { type: "LineString", coordinates: coords },
          properties: commonProps,
        });
      }
    }
  }

  return lines;
}

interface PipelineGeoJsonImportProps {
  projectId?: string;
  onImportComplete?: () => void;
}

export default function PipelineGeoJsonImport({
  projectId,
  onImportComplete,
}: PipelineGeoJsonImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileKind, setFileKind] = useState<"geojson" | "dxf">("geojson");
  const [previewCount, setPreviewCount] = useState<number>(0);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parsedLinesRef = useRef<ImportedLine[]>([]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setError(null);
    setSuccess(null);
    parsedLinesRef.current = [];
    setPreviewCount(0);
    setFile(null);
    if (!f) return;

    const name = f.name.toLowerCase();
    const isDxf = name.endsWith(".dxf");
    const isGeoJson = name.endsWith(".geojson") || name.endsWith(".json");
    if (!isDxf && !isGeoJson) {
      setError("Selectează un fișier GeoJSON (.geojson/.json) sau DXF (.dxf).");
      return;
    }
    setFileKind(isDxf ? "dxf" : "geojson");

    setFile(f);
    const text = await f.text();
    if (isDxf) {
      try {
        const lines = importDxfToLines(text);
        if (lines.length === 0) {
          setError("Nu am găsit entități de tip LINE/POLYLINE/LWPOLYLINE în DXF.");
          return;
        }
        parsedLinesRef.current = lines;
        setPreviewCount(lines.length);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Eroare la parsarea DXF.");
      }
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      setError("Fișier invalid: nu este JSON valid.");
      return;
    }

    if (!isFeatureCollection(json)) {
      setError("Fișier invalid: aștept un GeoJSON FeatureCollection.");
      return;
    }

    const lines = flattenLineGeometries(json);
    if (lines.length === 0) {
      setError("Nu am găsit linii (LineString/MultiLineString) în fișier.");
      return;
    }

    const first = lines[0]?.geom?.coordinates?.[0];
    if (first && !looksLikeLngLat(first)) {
      setError("Coordonatele nu par a fi WGS84 (lng/lat). Pentru Stereo 70 importă DXF direct.");
      return;
    }

    parsedLinesRef.current = lines;
    setPreviewCount(lines.length);
  }

  async function handleImport() {
    if (!projectId) {
      setError("Selectează un proiect înainte de import.");
      return;
    }
    const lines = parsedLinesRef.current;
    if (!lines.length) return;

    setImporting(true);
    setError(null);
    setSuccess(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const payload = lines.map((l) => ({
        project_id: projectId,
        type: "line",
        geom: l.geom,
        properties: l.properties ?? {},
        created_by: user?.id ?? null,
      }));

      const { error: insErr } = await supabase.from("map_annotations").insert(payload);
      if (insErr) {
        setError(insErr.message);
        return;
      }

      setSuccess(`Import reușit: ${lines.length} linii (conducte) adăugate pe hartă.`);
      setFile(null);
      parsedLinesRef.current = [];
      setPreviewCount(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onImportComplete?.();
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="bg-white rounded-lg border shadow-sm overflow-hidden">
      <h2 className="px-4 py-3 font-semibold text-slate-800 border-b">
        Import conducte (GeoJSON)
      </h2>
      <div className="p-4 space-y-4">
        <p className="text-sm text-slate-600">
          Poți importa fie:
          {" "}
          <strong>DXF Stereo 70 (EPSG:3844)</strong> (reproiectare automată în WGS84), fie
          {" "}
          <strong>GeoJSON</strong> deja în{" "}
          <code className="bg-slate-100 px-1 rounded">EPSG:4326</code>.
        </p>

        <div className="flex flex-wrap gap-4 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".dxf,.geojson,.json,application/geo+json,application/json"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 file:cursor-pointer"
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={!file || previewCount === 0 || importing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? "Se importă..." : `Importă ${previewCount ? `(${previewCount} linii)` : ""}`}
          </button>
        </div>
        {file && (
          <p className="text-xs text-slate-500">
            Fișier detectat: <strong>{fileKind.toUpperCase()}</strong>
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
        )}
        {success && (
          <p className="text-sm text-green-600 bg-green-50 p-2 rounded">{success}</p>
        )}
      </div>
    </section>
  );
}

