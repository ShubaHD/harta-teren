import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

/** Format dată ZZ-LL-AAAA (DD-MM-YYYY) */
function formatDDMMYYYY(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
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
  if (!user)
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin")
    return NextResponse.json({ error: "Doar admin" }, { status: 403 });

  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId)
    return NextResponse.json({ error: "Lipsește projectId" }, { status: 400 });

  const admin = createServiceClient();
  const { data: points, error } = await admin
    .from("drill_points")
    .select("code, lat, lng, status, assigned_team, final_depth, started_at, completed_at")
    .eq("project_id", projectId)
    .eq("status", "finalizat")
    .order("code");

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: project } = await admin
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .single();

  const name = (project?.name ?? "proiect").replace(/\s+/g, "-").replace(/[<>:"/\\|?*]/g, "_");
  const headers = [
    "code",
    "lat",
    "lng",
    "status",
    "echipa",
    "adancime_finala",
    "data_in_lucru",
    "finalizat",
  ];
  const rows = (points ?? []).map((p) => [
    escCsv(p.code),
    escCsv(String(p.lat)),
    escCsv(String(p.lng)),
    escCsv(p.status),
    escCsv(p.assigned_team ?? ""),
    escCsv(p.final_depth ?? ""),
    escCsv(formatDDMMYYYY(p.started_at)),
    escCsv(formatDDMMYYYY(p.completed_at)),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const bom = "\uFEFF";

  return new NextResponse(bom + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="situatie-actuala-${name}.csv"`,
    },
  });
}
