/**
 * Export Fișă Foraj: PDF, CSV, ZIP (Poze + PDF + CSV)
 * Layout conform imaginilor de referință (Geologic Site, FISA FORAJ)
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";
import type {
  DrillPoint,
  Project,
  LithologyInterval,
  Equipment,
  PocketPenetrometer,
  PocketVaneTest,
  RqdTcrScr,
  DynamicPenetrationInterval,
} from "@/lib/types";
import type { CachedDrillPointDetail } from "@/lib/offline-store";

export interface ExportPhoto {
  title: string;
  blob: Blob;
  rotation?: number;
}

export interface ExportData {
  point: DrillPoint;
  project: Project | null;
  detail: CachedDrillPointDetail | null;
  photos: ExportPhoto[];
}

function formatNum(n: number | string | null | undefined): string {
  if (n == null || n === "") return "—";
  const v = typeof n === "number" ? n : parseFloat(String(n));
  return isNaN(v) ? "—" : String(v);
}

function formatStr(s: string | null | undefined): string {
  return (s ?? "").trim() || "—";
}

function getLithologyConsistencyOrIndesare(
  interval: LithologyInterval
): string {
  if (interval.consistency) return interval.consistency;
  if (interval.sand_compaction) return interval.sand_compaction;
  return "—";
}

function computePenetrometerStats(valori: string): {
  medie: number;
  min: number;
  max: number;
} | null {
  if (!valori?.trim()) return null;
  const nums = valori
    .split(/[,;\s]+/)
    .map((s) => parseFloat(s.trim().replace(",", ".")))
    .filter((n) => !isNaN(n));
  if (nums.length === 0) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return {
    medie: Math.round((sum / nums.length) * 10) / 10,
    min: Math.round(Math.min(...nums) * 10) / 10,
    max: Math.round(Math.max(...nums) * 10) / 10,
  };
}

function computeRqdScrTcr(item: RqdTcrScr): {
  rqd: number;
  scr: number;
  tcr: number | null;
} {
  const runLengthM = Number(item.to_m) - Number(item.from_m);
  if (runLengthM <= 0) return { rqd: 0, scr: 0, tcr: null };
  const runLengthCm = runLengthM * 100;
  const pieces = (item.carota_gt_10cm || "")
    .split(/[,;\s]+/)
    .map((s) => parseFloat(s.trim().replace(",", ".")))
    .filter((n) => !isNaN(n) && n > 0);
  const sumGt10 = pieces.reduce((a, b) => a + b, 0);
  const rqd = Math.round((sumGt10 / runLengthCm) * 1000) / 10;
  const scr = rqd;
  const tcr =
    item.total_recovered_cm != null
      ? Math.round(
          (Number(item.total_recovered_cm) / runLengthCm) * 1000
        ) / 10
      : null;
  return { rqd, scr, tcr };
}

function formatPlunger(plunger: string): string {
  if (!plunger) return "—";
  const n = parseFloat(plunger);
  if (!isNaN(n)) return `${n}mm`;
  return plunger;
}

function addPdfHeader(doc: jsPDF) {
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(14, 10, 45, 18, 2, 2, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Geologic Site", 18, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(".ro / .com", 18, 24);

  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text("FISA FORAJ", doc.internal.pageSize.getWidth() - 14, 18, {
    align: "right",
  });
  doc.setTextColor(0, 0, 0);
}

function addPdfTitle(
  doc: jsPDF,
  projectName: string,
  forajCode: string,
  dateStr: string
) {
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  const title = projectName
    ? `FISA FORAJ - ${projectName}`
    : `FISA FORAJ - ${forajCode}`;
  doc.text(title, 14, 42);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Foraj ${forajCode} - ${dateStr}`, 14, 48);
}

export async function generatePdf(data: ExportData): Promise<jsPDF> {
  const { point, project, detail } = data;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 56;

  const dateStr = point.completed_at
    ? new Date(point.completed_at).toLocaleDateString("ro-RO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : new Date().toLocaleDateString("ro-RO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

  addPdfHeader(doc);
  addPdfTitle(
    doc,
    project?.name ?? "",
    point.code,
    dateStr
  );

  // Info proiect și foraj
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Nume proiect:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(project?.name ?? "—", margin + 30, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Beneficiar:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(project?.client ?? "—", margin + 30, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Tema:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(project?.topic ?? "—", margin + 30, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Locatie:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(project?.location ?? "—", margin + 30, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.text(`FORAJ: ${point.code}`, margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.text(
    `Adancime: ${formatStr(point.final_depth) || "—"}m`,
    margin,
    y
  );
  y += 5;
  doc.text(
    `Coordonate: ${formatNum(point.lat)}, ${formatNum(point.lng)}`,
    margin,
    y
  );
  y += 5;
  doc.text(`Kilometraj: ${formatStr(point.kilometraj)}`, margin, y);
  y += 5;
  doc.text(`Tip instalatie: ${formatStr(point.tip_instalatie)}`, margin, y);
  y += 5;
  if (point.tip_penetrare_dinamica) {
    doc.text(`Tip penetrare dinamica: ${point.tip_penetrare_dinamica}`, margin, y);
    y += 5;
  }
  y += 7;

  const isDynamicPenetration = ["DPSH", "DPM", "DPL", "DPH"].includes(point.tip_penetrare_dinamica ?? "");
  const INTERVAL_CM: Record<string, number> = { DPSH: 20, DPM: 10, DPL: 10, DPH: 10 };
  const stepM = (INTERVAL_CM[point.tip_penetrare_dinamica ?? ""] ?? 10) / 100;
  const maxDepthM = Math.max(0.1, parseFloat(String(point.final_depth ?? "0").replace(",", ".")) || 0);
  const savedDyn = (detail?.dynamicPenetration ?? []).sort(
    (a, b) => Number(a.from_m) - Number(b.from_m)
  ) as DynamicPenetrationInterval[];
  const dynamicIntervals: DynamicPenetrationInterval[] = [];
  for (let from = 0; from < maxDepthM; from += stepM) {
    const to = Math.min(from + stepM, maxDepthM);
    const fromR = Math.round(from * 1000) / 1000;
    const toR = Math.round(to * 1000) / 1000;
    const existing = savedDyn.find(
      (i) => Math.abs(Number(i.from_m) - fromR) < 0.001 && Math.abs(Number(i.to_m) - toR) < 0.001
    );
    dynamicIntervals.push({
      id: existing?.id ?? `${fromR}-${toR}`,
      drill_point_id: point.id,
      from_m: fromR,
      to_m: toR,
      blows: existing?.blows ?? 0,
      created_at: existing?.created_at ?? "",
      updated_at: existing?.updated_at ?? "",
    });
  }
  dynamicIntervals.sort((a, b) => Number(a.from_m) - Number(b.from_m));

  if (isDynamicPenetration) {
    // PENETRARE DINAMICĂ
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`PENETRARE DINAMICĂ (${point.tip_penetrare_dinamica})`, margin, y);
    y += 6;

    const dpRows = dynamicIntervals.map((i) => [
      formatNum(i.from_m),
      formatNum(i.to_m),
      String(i.blows ?? 0),
    ]);
    autoTable(doc, {
      startY: y,
      head: [["De la (m)", "Pana la (m)", "Batai (N)"]],
      body: dpRows.length ? dpRows : [["—", "—", "—"]],
      margin: { left: margin },
      tableWidth: pageW - 2 * margin,
      styles: { fontSize: 9, textColor: [0, 0, 0] },
      headStyles: { fillColor: [220, 220, 220], fontStyle: "bold", textColor: [0, 0, 0] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    // Diagramă penetrare dinamică
    if (dynamicIntervals.length > 0) {
      const maxBlows = Math.max(1, ...dynamicIntervals.map((i) => i.blows ?? 0));
      const maxDepth = Math.max(...dynamicIntervals.map((i) => Number(i.to_m)), 1);
      const chartW = 80;
      const chartH = 60;
      const chartX = margin;
      const chartY = y;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Diagrama N - adancime", margin, y - 2);
      y += 4;

      doc.setDrawColor(180, 180, 180);
      doc.rect(chartX, chartY, chartW, chartH);

      for (const i of dynamicIntervals) {
        const fromM = Number(i.from_m);
        const toM = Number(i.to_m);
        const blows = i.blows ?? 0;
        const barW = (blows / maxBlows) * (chartW - 4);
        const barTop = chartY + 2 + (fromM / maxDepth) * (chartH - 4);
        const barH = Math.max(2, ((toM - fromM) / maxDepth) * (chartH - 4));
        doc.setFillColor(59, 130, 246);
        doc.rect(chartX + 2, barTop, barW, barH, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("N (batai)", chartX + chartW / 2 - 10, chartY + chartH + 5);
      y = chartY + chartH + 12;
    }
  } else {
    // LITOLOGIE
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("LITOLOGIE", margin, y);
    y += 6;

    const lithology = detail?.lithology ?? [];
    const lithologyRows = lithology.map((i) => [
      formatNum(i.from_m),
      formatNum(i.to_m),
      formatStr(i.type),
      getLithologyConsistencyOrIndesare(i),
      formatStr(i.color),
      formatStr(i.notes),
    ]);

    autoTable(doc, {
      startY: y,
      head: [["De la (m)", "Pana la (m)", "Tip", "Consistenta", "Culoare", "Observatii"]],
      body: lithologyRows.length ? lithologyRows : [["—", "—", "—", "—", "—", "—"]],
      margin: { left: margin },
      tableWidth: pageW - 2 * margin,
      styles: { fontSize: 9, textColor: [0, 0, 0] },
      headStyles: { fillColor: [220, 220, 220], fontStyle: "bold", textColor: [0, 0, 0] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    // PROBE
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("PROBE", margin, y);
    y += 6;

    const samples = detail?.samples ?? [];
    const sampleRows = samples.map((s) => [
      formatNum(s.depth_m),
      formatStr(s.type),
      formatStr(s.spt_values),
      "—",
      formatStr(s.notes),
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Adancime (m)", "Tip", "Valori SPT", "Nspt", "Observatii"]],
      body: sampleRows.length ? sampleRows : [["—", "—", "—", "—", "—"]],
      margin: { left: margin },
      tableWidth: pageW - 2 * margin,
      styles: { fontSize: 9, textColor: [0, 0, 0] },
      headStyles: { fillColor: [220, 220, 220], fontStyle: "bold", textColor: [0, 0, 0] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // NIVELE APA (mereu – atât penetrare dinamică cât și litologie)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("NIVELE APA", margin, y);
  y += 6;

  const waterRows = [
    [
      dateStr,
      formatStr(point.water_during),
      formatStr(point.water_after_24h),
      "—",
    ],
  ];
  autoTable(doc, {
    startY: y,
    head: [["Data", "In timpul (m)", "Dupa 24h (m)", "Observatii"]],
    body: waterRows,
    margin: { left: margin },
    tableWidth: pageW - 2 * margin,
    styles: { fontSize: 9, textColor: [0, 0, 0] },
    headStyles: { fillColor: [220, 220, 220], fontStyle: "bold", textColor: [0, 0, 0] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // ECHIPARE
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("ECHIPARE", margin, y);
  y += 6;

  const equipment = detail?.equipment ?? [];
  if (equipment.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.text("Nicio intrare", margin, y);
    y += 10;
  } else {
    const equipRows = equipment.map((e) => [
      formatNum(e.from_m),
      formatNum(e.to_m),
      formatStr(e.type),
    ]);
    autoTable(doc, {
      startY: y,
      head: [["De la (m)", "Pana la (m)", "Tip"]],
      body: equipRows,
      margin: { left: margin },
      tableWidth: pageW - 2 * margin,
      styles: { fontSize: 9, textColor: [0, 0, 0] },
      headStyles: { fillColor: [220, 220, 220], fontStyle: "bold", textColor: [0, 0, 0] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // PENETROMETRU
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("PENETROMETRU (POCKET PENETROMETER)", margin, y);
  y += 6;

  const penetro = detail?.pocketPenetrometer ?? [];
  if (penetro.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.text("Nicio intrare", margin, y);
    y += 10;
  } else {
    const penetroRows = penetro.map((p) => {
      const stats = computePenetrometerStats(p.valori);
      return [
        formatNum(p.from_m),
        formatNum(p.to_m),
        formatPlunger(p.plunger),
        formatStr(p.valori),
        stats ? String(stats.medie) : "—",
        stats ? String(stats.min) : "—",
        stats ? String(stats.max) : "—",
      ];
    });
    autoTable(doc, {
      startY: y,
      head: [
        [
          "De la (m)",
          "Pana la (m)",
          "Plunger",
          "Valori (kg/cm²)",
          "Medie",
          "Min",
          "Max",
        ],
      ],
      body: penetroRows,
      margin: { left: margin },
      tableWidth: pageW - 2 * margin,
      styles: { fontSize: 9, textColor: [0, 0, 0] },
      headStyles: { fillColor: [220, 220, 220], fontStyle: "bold", textColor: [0, 0, 0] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // VAN TEST
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("VAN TEST (POCKET VAN TEST)", margin, y);
  y += 6;

  const vane = detail?.pocketVaneTest ?? [];
  if (vane.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.text("Nicio intrare", margin, y);
    y += 10;
  } else {
    const vaneRows = vane.map((v) => [
      formatNum(v.from_m),
      formatNum(v.to_m),
      formatNum(v.value_kg_cm2),
      formatStr(v.vane_diameter),
    ]);
    autoTable(doc, {
      startY: y,
      head: [["De la (m)", "Pana la (m)", "Valoare (kg/cm²)", "Diametru vane"]],
      body: vaneRows,
      margin: { left: margin },
      tableWidth: pageW - 2 * margin,
      styles: { fontSize: 9, textColor: [0, 0, 0] },
      headStyles: { fillColor: [220, 220, 220], fontStyle: "bold", textColor: [0, 0, 0] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // RQD, TCR, SCR
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RQD, TCR, SCR", margin, y);
  y += 6;

  const rqd = detail?.rqdTcrScr ?? [];
  if (rqd.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.text("Nicio intrare", margin, y);
  } else {
    const rqdRows = rqd.map((r) => {
      const { rqd: rqdVal, scr, tcr } = computeRqdScrTcr(r);
      return [
        formatNum(r.from_m),
        formatNum(r.to_m),
        formatNum(rqdVal),
        formatNum(tcr),
        formatNum(scr),
        ">10cm",
      ];
    });
    autoTable(doc, {
      startY: y,
      head: [["De la (m)", "Pana la (m)", "RQD %", "TCR %", "SCR %", "Regula SCR"]],
      body: rqdRows,
      margin: { left: margin },
      tableWidth: pageW - 2 * margin,
      styles: { fontSize: 9, textColor: [0, 0, 0] },
      headStyles: { fillColor: [220, 220, 220], fontStyle: "bold", textColor: [0, 0, 0] },
    });
  }

  // Poze / Locatie — câte o pagină per poză
  if (data.photos.length > 0) {
    const dateStrPhoto = point.completed_at
      ? new Date(point.completed_at).toLocaleDateString("ro-RO", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : new Date().toLocaleDateString("ro-RO", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });

    for (let i = 0; i < data.photos.length; i++) {
      const p = data.photos[i];
      try {
        const dataUrl = await blobToDataUrl(p.blob);
        const fmt = p.blob.type?.includes("png") ? "PNG" : "JPEG";
        doc.addPage();
        addPdfHeader(doc);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(p.title, margin, 38);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Foraj ${point.code} - ${dateStrPhoto}`, margin, 44);

        const imgW = pageW - 2 * margin;
        const imgH = Math.min(160, (imgW * 3) / 4);
        doc.addImage(dataUrl, fmt, margin, 50, imgW, imgH, undefined, "FAST");
      } catch {
        doc.addPage();
        addPdfHeader(doc);
        doc.text(p.title, margin, 40);
        doc.text("(Imagine indisponibilă)", margin, 48);
      }
    }
  }

  return doc;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function generateCsv(data: ExportData): string {
  const { point, project, detail } = data;
  const rows: string[][] = [];

  const esc = (v: string | number | null | undefined) => {
    const s = String(v ?? "").replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s}"`
      : s;
  };

  // Header principal
  rows.push(["FISA FORAJ - Date export"]);
  rows.push([]);
  rows.push([
    "Nume Proiect",
    "Beneficiar",
    "Tema",
    "Locatie",
    "Foraj",
    "Adancime finala (m)",
    "Coordonate (lat, lng)",
    "Kilometraj",
    "Tip instalatie",
    "Tip penetrare dinamica",
    "Intocmit",
    "Status",
    "Data finalizare",
  ]);
  rows.push([
    esc(project?.name),
    esc(project?.client),
    esc(project?.topic),
    esc(project?.location),
    esc(point.code),
    esc(point.final_depth),
    esc(`${point.lat}, ${point.lng}`),
    esc(point.kilometraj),
    esc(point.tip_instalatie),
    esc(point.tip_penetrare_dinamica),
    esc(point.intocmit),
    esc(point.status),
    esc(point.completed_at || ""),
  ]);
  rows.push([]);

  const isDynamicPenetration = ["DPSH", "DPM", "DPL", "DPH"].includes(point.tip_penetrare_dinamica ?? "");
  const INTERVAL_CM_CSV: Record<string, number> = { DPSH: 20, DPM: 10, DPL: 10, DPH: 10 };
  const stepMCsv = (INTERVAL_CM_CSV[point.tip_penetrare_dinamica ?? ""] ?? 10) / 100;
  const maxDepthMCsv = Math.max(0.1, parseFloat(String(point.final_depth ?? "0").replace(",", ".")) || 0);
  const savedDynCsv = (detail?.dynamicPenetration ?? []).sort(
    (a, b) => Number(a.from_m) - Number(b.from_m)
  ) as DynamicPenetrationInterval[];
  const dynamicIntervalsCsv: DynamicPenetrationInterval[] = [];
  for (let from = 0; from < maxDepthMCsv; from += stepMCsv) {
    const to = Math.min(from + stepMCsv, maxDepthMCsv);
    const fromR = Math.round(from * 1000) / 1000;
    const toR = Math.round(to * 1000) / 1000;
    const existing = savedDynCsv.find(
      (i) => Math.abs(Number(i.from_m) - fromR) < 0.001 && Math.abs(Number(i.to_m) - toR) < 0.001
    );
    dynamicIntervalsCsv.push({
      id: existing?.id ?? `${fromR}-${toR}`,
      drill_point_id: point.id,
      from_m: fromR,
      to_m: toR,
      blows: existing?.blows ?? 0,
      created_at: existing?.created_at ?? "",
      updated_at: existing?.updated_at ?? "",
    });
  }
  dynamicIntervalsCsv.sort((a, b) => Number(a.from_m) - Number(b.from_m));

  if (isDynamicPenetration) {
    rows.push([`=== PENETRARE DINAMICĂ (${point.tip_penetrare_dinamica}) ===`]);
    rows.push(["De la (m)", "Pana la (m)", "Batai (N)"]);
    for (const i of dynamicIntervalsCsv) {
      rows.push([esc(i.from_m), esc(i.to_m), esc(i.blows)]);
    }
    rows.push([]);
  } else {
  // Litologie
  rows.push(["=== LITOLOGIE ==="]);
  rows.push(["De la (m)", "Pana la (m)", "Tip", "Consistenta", "Culoare", "Observatii"]);
  for (const i of detail?.lithology ?? []) {
    rows.push([
      esc(i.from_m),
      esc(i.to_m),
      esc(i.type),
      esc(getLithologyConsistencyOrIndesare(i)),
      esc(i.color),
      esc(i.notes),
    ]);
  }
  rows.push([]);

  // Probe
  rows.push(["=== PROBE ==="]);
  rows.push(["Adancime (m)", "Tip", "Valori SPT", "Observatii"]);
  for (const s of detail?.samples ?? []) {
    rows.push([esc(s.depth_m), esc(s.type), esc(s.spt_values), esc(s.notes)]);
  }
  rows.push([]);

  // Nivel apa
  rows.push(["=== NIVELE APA ==="]);
  rows.push(["In timpul (m)", "Dupa 24h (m)"]);
  rows.push([esc(point.water_during), esc(point.water_after_24h)]);
  rows.push([]);

  // Echipare
  rows.push(["=== ECHIPARE ==="]);
  rows.push(["De la (m)", "Pana la (m)", "Tip"]);
  for (const e of detail?.equipment ?? []) {
    rows.push([esc(e.from_m), esc(e.to_m), esc(e.type)]);
  }
  rows.push([]);

  // Pocket Penetrometru
  rows.push(["=== PENETROMETRU ==="]);
  rows.push(["De la (m)", "Pana la (m)", "Plunger", "Valori", "Medie", "Min", "Max"]);
  for (const p of detail?.pocketPenetrometer ?? []) {
    const stats = computePenetrometerStats(p.valori);
    rows.push([
      esc(p.from_m),
      esc(p.to_m),
      esc(p.plunger),
      esc(p.valori),
      esc(stats?.medie),
      esc(stats?.min),
      esc(stats?.max),
    ]);
  }
  rows.push([]);

  // Pocket Vane
  rows.push(["=== VAN TEST ==="]);
  rows.push(["De la (m)", "Pana la (m)", "Valoare (kg/cm²)", "Diametru"]);
  for (const v of detail?.pocketVaneTest ?? []) {
    rows.push([
      esc(v.from_m),
      esc(v.to_m),
      esc(v.value_kg_cm2),
      esc(v.vane_diameter),
    ]);
  }
  rows.push([]);

  // RQD, TCR, SCR
  rows.push(["=== RQD, TCR, SCR ==="]);
  rows.push(["De la (m)", "Pana la (m)", "RQD %", "TCR %", "SCR %"]);
  for (const r of detail?.rqdTcrScr ?? []) {
    const { rqd, scr, tcr } = computeRqdScrTcr(r);
    rows.push([
      esc(r.from_m),
      esc(r.to_m),
      esc(rqd),
      esc(tcr),
      esc(scr),
    ]);
  }
  }

  return rows.map((r) => r.join(",")).join("\n");
}

function getExportBaseName(data: ExportData): string {
  return sanitizeFileName(
    `Foraj_${data.point.code.replace(/\s+/g, "-")}_${formatTimestamp()}`
  );
}

export async function exportPdf(data: ExportData): Promise<void> {
  const doc = await generatePdf(data);
  const baseName = getExportBaseName(data);
  doc.save(`${baseName}.pdf`);
}

/** Returnează PDF ca blob pentru Share sau altă utilizare */
export async function exportPdfAsBlob(
  data: ExportData
): Promise<{ blob: Blob; filename: string }> {
  const doc = await generatePdf(data);
  const baseName = getExportBaseName(data);
  const filename = `${baseName}.pdf`;
  const blob = doc.output("blob");
  return { blob, filename };
}

async function buildZipBlob(data: ExportData): Promise<{ blob: Blob; baseName: string }> {
  const zip = new JSZip();
  const baseName = getExportBaseName(data);

  const doc = await generatePdf(data);
  zip.file(`${baseName}.pdf`, doc.output("blob"));

  const csv = generateCsv(data);
  zip.file(`${baseName}.csv`, csv, { binary: false });

  const pozeFolder = zip.folder("Poze");
  if (pozeFolder && data.photos.length > 0) {
    for (let i = 0; i < data.photos.length; i++) {
      const p = data.photos[i];
      const ext = p.blob.type?.split("/")[1] || "jpg";
      const safeTitle = sanitizeFileName(p.title) || `poza-${i + 1}`;
      pozeFolder.file(`${safeTitle}.${ext}`, p.blob);
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, baseName };
}

export async function exportZip(data: ExportData): Promise<void> {
  const { blob, baseName } = await buildZipBlob(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Returnează ZIP ca blob pentru Share sau altă utilizare */
export async function exportZipAsBlob(
  data: ExportData
): Promise<{ blob: Blob; filename: string }> {
  const { blob, baseName } = await buildZipBlob(data);
  return { blob, filename: `${baseName}.zip` };
}

/** Adaugă conținutul unui foraj într-un ZIP existent, sub folderul dat (PDF, CSV, Poze) */
export async function addForajToZip(
  zip: import("jszip"),
  data: ExportData,
  folderName: string,
  opts?: { bundleMode?: boolean }
): Promise<void> {
  const folder = zip.folder(folderName);
  if (!folder) return;

  const baseName = opts?.bundleMode
    ? sanitizeFileName(`Foraj_${data.point.code.replace(/\s+/g, "-")}`)
    : getExportBaseName(data);

  const doc = await generatePdf(data);
  folder.file(`${baseName}.pdf`, doc.output("blob"));

  const csv = generateCsv(data);
  folder.file(`${baseName}.csv`, csv, { binary: false });

  const pozeFolder = folder.folder("Poze");
  if (pozeFolder && data.photos.length > 0) {
    for (let i = 0; i < data.photos.length; i++) {
      const p = data.photos[i];
      const ext = p.blob.type?.split("/")[1] || "jpg";
      const safeTitle = sanitizeFileName(p.title) || `poza-${i + 1}`;
      pozeFolder.file(`${safeTitle}.${ext}`, p.blob);
    }
  }
}

function sanitizeFileName(s: string): string {
  return s
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 100);
}

function formatTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
