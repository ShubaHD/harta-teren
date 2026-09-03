import type { DrillPoint } from "./types";

export type CsvLabelRow = { label: string; value: string };

function addRow(rows: CsvLabelRow[], label: string, value: unknown) {
  if (value == null) return;
  const v = String(value).trim();
  if (!v) return;
  rows.push({ label, value: v });
}

/** Rânduri etichetă CSV: nr., n, e, z, h, Echipare1, Echipare2, Observatii, Prioritate */
export function getCsvLabelRows(point: DrillPoint): CsvLabelRow[] {
  const rows: CsvLabelRow[] = [];
  addRow(rows, "nr.", point.code);
  addRow(rows, "n", point.lat);
  addRow(rows, "e", point.lng);
  addRow(rows, "z", point.elevation_h);
  const hVal = point.adancime_propusa?.toString().trim();
  if (hVal) {
    const cifra = hVal.replace(/\s*m\s*$/i, "").trim();
    addRow(rows, "Adâncime de forat", `${cifra} (m)`);
  }
  addRow(rows, "Echipare1", point.echipare1);
  addRow(rows, "Echipare2", point.echipare2);
  addRow(rows, "Observatii", point.notes);
  addRow(rows, "Prioritate", point.prioritate);
  const pmtRanges = parsePressuremeterRanges(point.pressuremeter_test);
  if (pmtRanges.length === 1) {
    addRow(rows, "Pressuremeter Test", pmtRanges[0]);
  } else {
    pmtRanges.forEach((range, i) => {
      addRow(rows, `Pressuremeter Test ${i + 1}`, range);
    });
  }
  addRow(rows, "km", point.kilometraj);
  return rows;
}

/** Press.4-7 → ["4 m", "7 m"]; 0 → []; 4m\\n7m → ["4 m", "7 m"] */
export function parsePressuremeterRanges(raw: string | null | undefined): string[] {
  if (raw == null) return [];
  const t = String(raw).trim();
  if (!t) return [];
  if (/^(0+|0[,.]0*|[-–]|n\/?a|nu)$/i.test(t)) return [];

  const press = t.match(/^press\.?\s*(.+)$/i);
  if (press) {
    const nums = [...press[1].matchAll(/(\d+(?:[.,]\d+)?)/g)].map((m) =>
      m[1].replace(",", ".")
    );
    return nums.map((n) => `${n} m`);
  }

  const withM = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*m/gi)].map((m) =>
    m[1].replace(",", ".")
  );
  if (withM.length > 0) return withM.map((n) => `${n} m`);

  const nums = [...t.matchAll(/(\d+(?:[.,]\d+)?)/g)].map((m) => m[1].replace(",", "."));
  if (nums.length >= 2) return nums.map((n) => `${n} m`);
  return [];
}
