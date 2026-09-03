/**
 * Convertește coordonate DMS (grade°minute'secunde"Direcție) în grade zecimale
 * Exemplu: "44°37'40.88966""N" → 44.6280
 * Acceptă și simboluri corupte () din cauza encoding-ului (ex. Windows-1252 citit ca UTF-8)
 */
export function dmsToDecimal(dmsStr: string): number | null {
  if (!dmsStr || typeof dmsStr !== "string") return null;
  const cleaned = dmsStr
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/""/g, '"')
    .replace(/\uFFFD/g, "°"); // Fix encoding: când fișierul e Windows-1252 citit ca UTF-8
  const match = cleaned.match(/(\d+)[°º]\s*(\d+)['′]\s*([\d.]+)["″\s]*([NSEW])?/i);
  if (!match) return null;
  const degrees = parseFloat(match[1]);
  const minutes = parseFloat(match[2]);
  const seconds = parseFloat(match[3]);
  const dir = (match[4] || "").toUpperCase();
  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (dir === "S" || dir === "W") decimal = -decimal;
  return Math.round(decimal * 100000) / 100000;
}

export interface ParsedDrillPoint {
  code: string;
  lat: number;
  lng: number;
  notes: string | null;
  kilometraj: string | null;
  /** Cota / elevație – coloană z sau elevatie/elevation (h = doar adâncime propusă) */
  elevation_h: string | null;
  /** Adâncime propusă (m) – vine doar din coloana h */
  adancime_propusa: string | null;
  echipare1: string | null;
  echipare2: string | null;
  /** "1" | "2" | "3" sau null */
  prioritate: string | null;
  pressuremeter_test: string | null;
}

const normHeader = (s: string) => s.trim().toLowerCase().replace(/[.\s_]/g, "");

/** FI_61+120 și Fi61+120 → FI61+120 (ignoră majuscule, spații, underscore) */
export function normalizeDrillPointCode(code: string): string {
  return code.trim().replace(/[\s_]+/g, "").toUpperCase();
}

export function findExistingPointByCode<T extends { id: string; code: string }>(
  existing: T[],
  csvCode: string,
  usedIds?: Set<string>
): T | undefined {
  const available = usedIds ? existing.filter((p) => !usedIds.has(p.id)) : existing;
  const exact = available.find((p) => p.code === csvCode);
  if (exact) return exact;
  const key = normalizeDrillPointCode(csvCode);
  return available.find((p) => normalizeDrillPointCode(p.code) === key);
}

/** Extrage 1, 2 sau 3 din valoarea coloanei Prioritate */
export function normalizePrioritate(raw: string | null | undefined): "1" | "2" | "3" | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  const m = t.match(/\b([123])\b/);
  return m ? (m[1] as "1" | "2" | "3") : null;
}

/**
 * Parsează un rând CSV în format: nr,n,e,z,h,Echipare1,Echipare2,Observatii,Prioritate
 * (z, echipare și prioritate sunt opționale; rămâne valid și formatul vechi nr,n,e,h)
 */
export function parseCsvRow(
  row: string[],
  headers: string[]
): ParsedDrillPoint | null {
  const getCol = (name: string) => {
    const i = headers.findIndex((h) => normHeader(h) === normHeader(name));
    return i >= 0 ? (row[i] || "").trim() : "";
  };

  const code = getCol("nr") || getCol("nr.") || getCol("code");
  if (!code) return null;

  const nStr = getCol("n") || getCol("lat");
  const eStr = getCol("e") || getCol("lng");
  const lat = nStr ? dmsToDecimal(nStr) ?? parseFloat(nStr) : null;
  const lng = eStr ? dmsToDecimal(eStr) ?? parseFloat(eStr) : null;

  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return null;

  const hRaw = getCol("h");
  const adancime_propusa = hRaw?.trim() || null;
  const elevatieRaw = getCol("z") || getCol("elevatie") || getCol("elevation");
  const elevation_h = elevatieRaw?.trim() || null;
  const kilometrajRaw = getCol("km") || getCol("kilometraj");
  const kilometraj = kilometrajRaw?.trim() || null;
  const obs1 = getCol("observatii") || getCol("observatii1");
  const obs2 = getCol("observatii2");
  const obs3 = getCol("observatii3");
  const notes = [obs1, obs2, obs3].filter(Boolean).length
    ? [obs1, obs2, obs3].filter(Boolean).join("\n")
    : null;
  const echipare1 = getCol("echipare1")?.trim() || null;
  const echipare2 = getCol("echipare2")?.trim() || null;
  const prioritate = normalizePrioritate(getCol("prioritate"));
  const pressuremeterRaw =
    getCol("pressuremeter test")?.trim() ||
    getCol("pressuremetertest")?.trim() ||
    getCol("pressuremeter")?.trim() ||
    "";
  const pressuremeter_test =
    !pressuremeterRaw || /^(0+|0[,.]0*)$/i.test(pressuremeterRaw)
      ? null
      : pressuremeterRaw;

  return {
    code: code.replace(/\s+/g, " ").trim(),
    lat,
    lng,
    notes,
    kilometraj,
    elevation_h,
    adancime_propusa,
    echipare1,
    echipare2,
    prioritate,
    pressuremeter_test,
  };
}

/**
 * Parsează conținutul CSV și returnează lista de puncte.
 * Respectă câmpuri între ghilimele cu rânduri noi (ex. Pressuremeter: "4m\\n7m").
 */
export function parseCsvContent(csvText: string): ParsedDrillPoint[] {
  const table = parseCsvToRows(csvText);
  if (table.length < 2) return [];

  const headers = table[0].map((h, i) =>
    i === 0 ? h.replace(/^\uFEFF/, "") : h
  );
  const points: ParsedDrillPoint[] = [];

  for (let i = 1; i < table.length; i++) {
    const point = parseCsvRow(table[i], headers);
    if (point) points.push(point);
  }

  return points;
}

/** Împarte CSV în rânduri/celule; newline în interiorul ghilimelelor rămâne în celulă. */
export function parseCsvToRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;
  const text = csvText.replace(/^\uFEFF/, "");

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && (c === "," || c === ";")) {
      row.push(current.trim());
      current = "";
    } else if (!inQuotes && (c === "\n" || c === "\r")) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(current.trim());
      current = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    } else {
      current += c;
    }
  }
  row.push(current.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}
