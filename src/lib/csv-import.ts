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
}

/**
 * Parsează un rând CSV în format: nr,n,e,h[,observatii,observatii2,observatii3]
 */
export function parseCsvRow(
  row: string[],
  headers: string[]
): ParsedDrillPoint | null {
  const getCol = (name: string) => {
    const i = headers.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
    return i >= 0 ? (row[i] || "").trim() : "";
  };

  const code = getCol("nr") || getCol("nr.") || getCol("code");
  if (!code) return null;

  const nStr = getCol("n") || getCol("lat");
  const eStr = getCol("e") || getCol("lng");
  const lat = nStr ? dmsToDecimal(nStr) ?? parseFloat(nStr) : null;
  const lng = eStr ? dmsToDecimal(eStr) ?? parseFloat(eStr) : null;

  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return null;

  const h = getCol("h");
  const km = getCol("km");
  const obs1 = getCol("observatii") || getCol("observatii1");
  const obs2 = getCol("observatii2");
  const obs3 = getCol("observatii3");
  const parts: string[] = [];
  if (h) {
    const hNum = parseFloat(h);
    parts.push(isNaN(hNum) ? `h: ${h}` : `h: ${h} m`);
  }
  if (km) parts.push(`km: ${km}`);
  [obs1, obs2, obs3].filter(Boolean).forEach((o) => parts.push(o));
  const notes = parts.length ? parts.join("\n") : null;

  return {
    code: code.replace(/\s+/g, " ").trim(),
    lat,
    lng,
    notes,
  };
}

/**
 * Parsează conținutul CSV și returnează lista de puncte
 */
export function parseCsvContent(csvText: string): ParsedDrillPoint[] {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if ((c === "," && !inQuotes) || (c === ";" && !inQuotes)) {
        result.push(current);
        current = "";
      } else {
        current += c;
      }
    }
    result.push(current);
    return result;
  };

  const headers = parseRow(lines[0]);
  const points: ParsedDrillPoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i]);
    const point = parseCsvRow(row, headers);
    if (point) points.push(point);
  }

  return points;
}
