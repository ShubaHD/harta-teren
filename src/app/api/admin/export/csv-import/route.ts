import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

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
    .select("code, lat, lng, elevation_h, kilometraj, notes, adancime_propusa")
    .eq("project_id", projectId)
    .order("code");

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: project } = await admin
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .single();

  const name = (project?.name ?? "proiect").replace(/\s+/g, "-").replace(/[<>:"/\\|?*]/g, "_");
  const headers = ["nr", "n", "e", "h", "km", "observatii"];
  const rows = (points ?? []).map((p) => {
    const pt = p as { adancime_propusa?: string | null };
    return [
      escCsv(p.code),
      escCsv(String(p.lat)),
      escCsv(String(p.lng)),
      escCsv(pt.adancime_propusa ?? ""),
      escCsv(p.kilometraj ?? ""),
      escCsv(p.notes ?? ""),
    ];
  });
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const bom = "\uFEFF";

  return new NextResponse(bom + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="export-format-import-${name}.csv"`,
    },
  });
}
