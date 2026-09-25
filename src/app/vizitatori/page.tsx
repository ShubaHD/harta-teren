import { createServiceClient } from "@/lib/supabase/service";
import VizitatoriListClient from "@/components/VizitatoriListClient";

export default async function VizitatoriListPage() {
  const supabase = createServiceClient();
  const { data: allProjects } = await supabase
    .from("projects")
    .select("id, name")
    .order("name");

  // Ascunde "Proiect implicit" (nu mai există ca proiect real)
  const IMPLICIT_PROJECT_ID = "00000000-0000-0000-0000-000000000001";
  const projects = allProjects?.filter((p) => p.id !== IMPLICIT_PROJECT_ID) ?? [];

  return <VizitatoriListClient projects={projects} />;
}
