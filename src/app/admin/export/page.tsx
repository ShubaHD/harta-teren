import { createClient } from "@/lib/supabase/server";
import AdminExportClient from "./AdminExportClient";

export const dynamic = "force-dynamic";

const IMPLICIT_PROJECT_ID = "00000000-0000-0000-0000-000000000001";

export default async function AdminExportPage() {
  const supabase = await createClient();
  const { data: allProjects } = await supabase
    .from("projects")
    .select("id, name")
    .order("name");

  const projects = (allProjects ?? []).filter((p) => p.id !== IMPLICIT_PROJECT_ID);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-xl font-bold text-slate-800">Export</h1>
      <AdminExportClient projects={projects} />
    </div>
  );
}
