import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProjectDetail from "@/components/ProjectDetail";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const { data: points } = await supabase
    .from("drill_points")
    .select("*")
    .eq("project_id", id)
    .order("code");

  const stats = {
    total: points?.length ?? 0,
    de_facut: points?.filter((p) => p.status === "de_facut").length ?? 0,
    in_lucru: points?.filter((p) => p.status === "in_lucru").length ?? 0,
    finalizat: points?.filter((p) => p.status === "finalizat").length ?? 0,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/proiecte" className="text-slate-600 hover:text-slate-800 text-sm">
          ← Proiecte
        </Link>
        <h1 className="text-xl font-bold text-slate-800">{project.name}</h1>
        <Link
          href={`/mapa?project=${id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          Vezi pe hartă
        </Link>
        <Link
          href={`/vizitatori/${id}`}
          target="_blank"
          className="text-sm text-slate-500 hover:underline"
        >
          Link vizitatori
        </Link>
      </div>
      <ProjectDetail
        projectId={id}
        projectName={project.name}
        points={points ?? []}
        stats={stats}
      />
    </div>
  );
}
