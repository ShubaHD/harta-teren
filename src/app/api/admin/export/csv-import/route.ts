import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { canExportProject } from "@/lib/project-access";
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

  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId)
    return NextResponse.json({ error: "Lipsește projectId" }, { status: 400 });

  const allowed = await canExportProject(supabase, user.id, profile?.role, projectId);
  if (!allowed)
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });

  const admin = createServiceClient();
  const { data: points, error } = await admin
    .from("drill_points")
    .select("code, lat, lng, elevation_h, notes, adancime_propusa, echipare1, echipare2, prioritate, pressuremeter_test")
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
  const headers = ["nr.", "n", "e", "z", "h", "Echipare1", "Echipare2", "Observatii", "Prioritate", "Pressuremeter Test"];
  const rows = (points ?? []).map((p) => {
    const pt = p as {
      adancime_propusa?: string | null;
      echipare1?: string | null;
      echipare2?: string | null;
      prioritate?: string | null;
      pressuremeter_test?: string | null;
    };
    return [
      escCsv(p.code),
      escCsv(String(p.lat)),
      escCsv(String(p.lng)),
      escCsv(p.elevation_h ?? ""),
      escCsv(pt.adancime_propusa ?? ""),
      escCsv(pt.echipare1 ?? ""),
      escCsv(pt.echipare2 ?? ""),
      escCsv(p.notes ?? ""),
      escCsv(pt.prioritate ?? ""),
      escCsv(pt.pressuremeter_test ?? ""),
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
