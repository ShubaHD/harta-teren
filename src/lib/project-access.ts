import type { createClient } from "@/lib/supabase/server";

export const IMPLICIT_PROJECT_ID = "00000000-0000-0000-0000-000000000001";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/** Proiectele pe care le poate vedea un user: admin = toate; echipă cu restricții = doar cele bifate. */
export async function getVisibleProjects(
  supabase: ServerSupabase,
  userId: string,
  role?: string | null
): Promise<{ id: string; name: string }[]> {
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .order("name");
  const all = (projects ?? []).filter((p) => p.id !== IMPLICIT_PROJECT_ID);

  if (role === "admin") return all;

  const { data: access } = await supabase
    .from("project_access")
    .select("project_id")
    .eq("user_id", userId);

  const ids = (access ?? []).map((row) => row.project_id).filter(Boolean);
  if (ids.length === 0) return all;

  const allowed = new Set(ids);
  return all.filter((p) => allowed.has(p.id));
}
