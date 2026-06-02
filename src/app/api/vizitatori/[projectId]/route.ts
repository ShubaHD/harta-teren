import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  if (!projectId) return NextResponse.json({ error: "Project ID required" }, { status: 400 });

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Config error" }, { status: 500 });
  }
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .single();

  if (!project) return NextResponse.json({ error: "Proiect negăsit" }, { status: 404 });

  const { data: points, error } = await supabase
    .from("drill_points")
    .select("*")
    .eq("project_id", projectId)
    .order("code");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { project, points: points ?? [] },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
