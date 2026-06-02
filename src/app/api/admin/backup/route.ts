import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

/** Tabele de exportat (ordine: proiecte, utilizatori, puncte, restul) */
const BACKUP_TABLES = [
  "projects",
  "profiles",
  "drill_points",
  "map_annotations",
  "lithology_intervals",
  "samples",
  "equipment",
  "pocket_penetrometer",
  "pocket_vane_test",
  "rqd_tcr_scr",
  "borehole_photos",
  "dynamic_penetration_intervals",
] as const;

export async function GET() {
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

  const admin = createServiceClient();
  const backup: Record<string, unknown[]> = {
    _meta: [
      {
        exported_at: new Date().toISOString(),
        tables: [...BACKUP_TABLES],
      },
    ] as unknown[],
  };

  for (const table of BACKUP_TABLES) {
    const { data, error } = await admin.from(table).select("*");
    if (error) {
      if (error.code === "42P01") continue; // tabel inexistent, sări
      return NextResponse.json(
        { error: `Eroare la ${table}: ${error.message}` },
        { status: 500 }
      );
    }
    backup[table] = data ?? [];
  }

  const filename = `backup-hartateren-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "-")}.json`;
  return new NextResponse(JSON.stringify(backup, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
