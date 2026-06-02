import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import VisitorView from "@/components/VisitorView";

// Lista de puncte trebuie mereu proaspătă (ex. după ștergere în admin)
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VizitatoriPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, topic, location, client")
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
      project={project}
      points={points ?? []}
    />
  );
}
