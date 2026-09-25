import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getVisibleProjects } from "@/lib/project-access";
import AdminExportClient from "@/app/admin/export/AdminExportClient";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const projects = await getVisibleProjects(supabase, user.id, profile?.role);
  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-4 shrink-0">
        <Link
          href={isAdmin ? "/admin" : "/mapa"}
          className="text-slate-600 hover:text-slate-800 text-sm font-medium"
        >
          ← {isAdmin ? "Admin" : "Hartă"}
        </Link>
        <h1 className="font-semibold text-slate-800">Export</h1>
      </header>
      <main className="max-w-2xl mx-auto p-4 space-y-8">
        <AdminExportClient projects={projects} />
      </main>
    </div>
  );
}
