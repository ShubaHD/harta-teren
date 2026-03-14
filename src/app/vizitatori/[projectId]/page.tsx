import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import VisitorView from "@/components/VisitorView";

export default async function VizitatoriPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .single();

  if (!project) notFound();

  const { data: points } = await supabase
    .from("drill_points")
    .select("*")
    .eq("project_id", projectId)
    .order("code");

  return (
    <VisitorView
      projectId={projectId}
      projectName={project.name}
      points={points ?? []}
    />
  );
}
