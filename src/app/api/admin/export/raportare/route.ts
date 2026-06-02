import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

function formatDDMMYYYYFromDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function escCsv(val: string | null | undefined): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Doar admin" }, { status: 403 });
  }

  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "Lipsește projectId" }, { status: 400 });
  }

  const admin = createServiceClient();

  const { data: points, error } = await admin
    .from("drill_points")
    .select("code, status, final_depth, completed_at, adancime_propusa")
    .eq("project_id", projectId)
    .order("code");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Pentru raportare, includem doar forajele finalizate
  const finalizedPoints = (points ?? []).filter((p) => p.status === "finalizat");

  const { data: project } = await admin
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .single();

  const name = (project?.name ?? "proiect")
    .replace(/\s+/g, "-")
    .replace(/[<>:"/\\|?*]/g, "_");

  const reportStart = new Date(2026, 2, 10);
  const reportEnd = new Date(2026, 11, 31);

  const days: Date[] = [];
  for (let d = new Date(reportStart); d <= reportEnd; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  const headers = [
    "Nr inv",
    "Adancime propusa",
    "Finalizat",
    ...days.map((d) => formatDDMMYYYYFromDate(d)),
  ];

  const rows: string[][] = [];

  for (const p of finalizedPoints) {
    const completedIso = p.completed_at as string | null;
    const isFinalizat = p.status === "finalizat";
    const completedDate =
      completedIso && isFinalizat
        ? new Date(
            new Date(completedIso).getFullYear(),
            new Date(completedIso).getMonth(),
            new Date(completedIso).getDate()
          )
        : null;

    const adancimePropusa = (p as Record<string, unknown>).adancime_propusa;
    const adancimePropusaStr =
      adancimePropusa != null && adancimePropusa !== "" ? String(adancimePropusa).trim() : "";

    const row: string[] = [];
    row.push(escCsv(p.code));
    row.push(escCsv(adancimePropusaStr));
    row.push(escCsv("Finalizat"));

    for (const d of days) {
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const isCompletedOnThisDay =
        isFinalizat &&
        completedDate &&
        dayStart.getTime() === completedDate.getTime() &&
        p.final_depth != null &&
        p.final_depth !== "";

      if (isCompletedOnThisDay) {
        row.push(escCsv(p.final_depth));
      } else {
        row.push("");
      }
    }

    rows.push(row);
  }

  const dailyTotals: string[] = [];
  for (let i = 0; i < days.length; i++) {
    let sum = 0;
    let hasAny = false;
    for (const row of rows) {
      const cell = row[3 + i];
      if (cell !== "") {
        const n = parseFloat(String(cell).replace(",", "."));
        if (!Number.isNaN(n)) {
          sum += n;
          hasAny = true;
        }
      }
    }
    dailyTotals.push(hasAny ? String(sum) : "0.00");
  }

  const csvRows: string[] = [];
  csvRows.push(headers.join(","));
  for (const r of rows) {
    csvRows.push(r.join(","));
  }
  csvRows.push(
    ["DAILY T.", "", "", ...dailyTotals].join(","),
  );

  const csv = csvRows.join("\n");
  const bom = "\uFEFF";

  return new NextResponse(bom + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="raportare-2026-${name}.csv"`,
    },
  });
}

