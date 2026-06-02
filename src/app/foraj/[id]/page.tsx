import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ForajPageClient from "./ForajPageClient";

export default async function ForajPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // getSession() citește din cookie – funcționează și offline; getUser() necesită rețea
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/");

  const { data: point, error } = await supabase
    .from("drill_points")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !point) {
    // Punct inexistent în DB (cod PGRST116) → 404; altfel (ex. rețea) → randare cu null pentru offline/cache
    const isNotFound = error?.code === "PGRST116";
    if (isNotFound) notFound();
    return (
      <ForajPageClient
        drillPointId={id}
        initialPoint={null}
        initialProject={null}
      />
    );
  }

  let project = null;
  if (point.project_id) {
    const { data: proj } = await supabase
      .from("projects")
      .select("*")
      .eq("id", point.project_id)
      .single();
    project = proj;
  }

  return (
    <ForajPageClient
      drillPointId={id}
      initialPoint={point}
      initialProject={project}
    />
  );
}
