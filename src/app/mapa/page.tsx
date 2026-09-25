import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MapView from "@/components/MapView";
import ProjectSelectScreen from "@/components/ProjectSelectScreen";
import MapPageHeader from "@/components/MapPageHeader";
import OfflinePrepTip from "@/components/OfflinePrepTip";

export default async function MapaPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: projectId } = await searchParams;
  const supabase = await createClient();

  // getSession() din cookie – funcționează offline; getUser() necesită rețea
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/");

  let profile: { role?: string; team_name?: string | null } | null = null;
  let projects: { id: string; name: string }[] = [];
  const [profileRes, projectsRes] = await Promise.all([
    supabase.from("profiles").select("role, team_name").eq("id", session.user.id).single(),
    supabase.from("projects").select("id, name").order("name"),
  ]);
  if (!profileRes.error) profile = profileRes.data;
  if (!projectsRes.error) projects = projectsRes.data ?? [];
  // Când ești offline, profile/projects pot rămâne goale – MapView încarcă punctele din cache

  const effectiveProjectId =
    projectId ?? (projects?.length === 1 ? projects[0].id : null);

  return (
    <div className="h-screen app-fullscreen flex flex-col">
      <MapPageHeader
        projects={projects}
        selectedId={effectiveProjectId}
        isAdmin={profile?.role === "admin"}
      />
      <main className="flex-1 min-h-0">
        {!effectiveProjectId && projects.length > 1 ? (
          <ProjectSelectScreen projects={projects} />
        ) : (
          <MapView
            isAdmin={profile?.role === "admin"}
            projectId={effectiveProjectId ?? undefined}
            initialUserId={session.user.id}
            initialTeamName={profile?.team_name ?? undefined}
          />
        )}
      </main>
      <OfflinePrepTip />
    </div>
  );
}
