import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import MapView from "@/components/MapView";
import MapProjectSelector from "@/components/MapProjectSelector";
import ProjectSelectScreen from "@/components/ProjectSelectScreen";
import BackButton from "@/components/BackButton";
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
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-white border-b shrink-0 min-h-0 safe-area-left safe-area-right">
        <div className="flex items-center gap-2 min-w-0 shrink">
          <BackButton />
          <h1 className="font-semibold text-slate-800 text-sm sm:text-base truncate">Harta Teren</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <MapProjectSelector
            projects={projects}
            selectedId={effectiveProjectId}
          />
          {profile?.role === "admin" && (
            <Link href="/admin" className="text-xs sm:text-sm text-blue-600 hover:underline shrink-0 min-h-[44px] inline-flex items-center">
              Admin
            </Link>
          )}
          <form action="/auth/signout" method="post" className="shrink-0">
            <button type="submit" className="text-xs sm:text-sm text-slate-600 hover:text-slate-800 min-h-[44px] px-2 -mx-2 inline-flex items-center touch-manipulation">
              Ieșire
            </button>
          </form>
        </div>
      </header>
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
