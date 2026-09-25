import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MapView from "@/components/MapView";
import ProjectSelectScreen from "@/components/ProjectSelectScreen";
import MapPageHeader from "@/components/MapPageHeader";
import OfflinePrepTip from "@/components/OfflinePrepTip";
import { getVisibleProjects } from "@/lib/project-access";

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
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("role, team_name")
    .eq("id", session.user.id)
    .single();
  if (!profileError) profile = profileData;

  let projects: { id: string; name: string }[] = [];
  try {
    projects = await getVisibleProjects(supabase, session.user.id, profile?.role);
  } catch {
    projects = [];
  }
  // Când ești offline, profile/projects pot rămâne goale – MapView încarcă punctele din cache

  const allowedIds = new Set(projects.map((p) => p.id));
  const requestedId = projectId && allowedIds.has(projectId) ? projectId : null;
  const effectiveProjectId =
    requestedId ?? (projects?.length === 1 ? projects[0].id : null);

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
