import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import FisaForajClient from "./FisaForajClient";

export default async function FisaForajPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: projectId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .order("name");

  let points: { id: string; code: string; status: string }[] = [];
  let projectName = "";

  if (projectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .single();
    if (project) {
      projectName = project.name;
      const { data } = await supabase
        .from("drill_points")
        .select("id, code, status")
        .eq("project_id", projectId)
        .order("code");
      points = data ?? [];
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-4 shrink-0">
        <Link
          href="/mapa"
          className="text-slate-600 hover:text-slate-800 text-sm font-medium"
        >
          ← Înapoi la hartă
        </Link>
        <h1 className="font-semibold text-slate-800">Fișa de foraj</h1>
      </header>
      <main className="flex-1 p-6">
        <FisaForajClient
          projects={projects ?? []}
          selectedProjectId={projectId ?? null}
          points={points}
          projectName={projectName}
        />
      </main>
    </div>
  );
}
