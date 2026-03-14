import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import MapView from "@/components/MapView";
import MapProjectSelector from "@/components/MapProjectSelector";
import ProjectSelectScreen from "@/components/ProjectSelectScreen";
import BackButton from "@/components/BackButton";

export default async function MapaPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: projectId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .order("name");

  const effectiveProjectId =
    projectId ?? (projects?.length === 1 ? projects[0].id : null);

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b shrink-0">
        <div className="flex items-center gap-3">
          <BackButton />
          <h1 className="font-semibold text-slate-800">Harta Teren</h1>
        </div>
        <div className="flex items-center gap-4">
          <MapProjectSelector
            projects={projects ?? []}
            selectedId={effectiveProjectId}
          />
          {profile?.role === "admin" && (
            <Link href="/admin" className="text-sm text-blue-600 hover:underline">
              Admin
            </Link>
          )}
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm text-slate-600 hover:text-slate-800">
              Ieșire
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 min-h-[300px]">
        {!effectiveProjectId && projects && projects.length > 1 ? (
          <ProjectSelectScreen projects={projects} />
        ) : (
          <MapView
            isAdmin={profile?.role === "admin"}
            projectId={effectiveProjectId ?? undefined}
          />
        )}
      </main>
    </div>
  );
}
