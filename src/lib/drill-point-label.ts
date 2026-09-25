import type { DrillPoint } from "./types";
import type { ro } from "./i18n/messages";

type MessageKey = keyof typeof ro;

export type CsvLabelRow = {
  key: MessageKey;
  value: string;
  vars?: Record<string, string | number>;
};

function addRow(
  rows: CsvLabelRow[],
  key: MessageKey,
  value: unknown,
  vars?: Record<string, string | number>
) {
  if (value == null) return;
  const v = String(value).trim();
  if (!v) return;
  rows.push(vars ? { key, value: v, vars } : { key, value: v });
}

/** Rânduri etichetă CSV: nr., n, e, z, h, Echipare1, Echipare2, Observatii, Prioritate */
export function getCsvLabelRows(point: DrillPoint): CsvLabelRow[] {
  const rows: CsvLabelRow[] = [];
  addRow(rows, "csv.nr", point.code);
  addRow(rows, "csv.n", point.lat);
  addRow(rows, "csv.e", point.lng);
  addRow(rows, "csv.z", point.elevation_h);
  const hVal = point.adancime_propusa?.toString().trim();
  if (hVal) {
    const cifra = hVal.replace(/\s*m\s*$/i, "").trim();
    addRow(rows, "csv.depth", `${cifra} (m)`);
  }
  addRow(rows, "csv.equipment1", point.echipare1);
  addRow(rows, "csv.equipment2", point.echipare2);
  addRow(rows, "csv.notes", point.notes);
  addRow(rows, "csv.priority", point.prioritate);
  const pmtRanges = parsePressuremeterRanges(point.pressuremeter_test);
  if (pmtRanges.length === 1) {
    addRow(rows, "csv.pmt", pmtRanges[0]);
  } else {
    pmtRanges.forEach((range, i) => {
      addRow(rows, "csv.pmtN", range, { n: i + 1 });
    });
  }
  addRow(rows, "csv.km", point.kilometraj);
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
