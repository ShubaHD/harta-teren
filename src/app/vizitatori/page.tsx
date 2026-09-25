import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import VizitatoriListClient from "@/components/VizitatoriListClient";
import { IMPLICIT_PROJECT_ID } from "@/lib/project-access";

export default async function VizitatoriListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/mapa");

  const admin = createServiceClient();
  const { data: allProjects } = await admin
    .from("projects")
    .select("id, name")
    .order("name");

  const projects = allProjects?.filter((p) => p.id !== IMPLICIT_PROJECT_ID) ?? [];

  return <VizitatoriListClient projects={projects} />;
}
