import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .order("created_at", { ascending: false });

  const statsByProject = await Promise.all(
    (projects ?? []).map(async (p) => {
      const { data: projectPoints } = await supabase
        .from("drill_points")
        .select("id, status")
        .eq("project_id", p.id);
      const pts = projectPoints ?? [];
      return {
        project: p,
        total: pts.length,
        de_facut: pts.filter((pt) => pt.status === "de_facut").length,
        in_lucru: pts.filter((pt) => pt.status === "in_lucru").length,
        finalizat: pts.filter((pt) => pt.status === "finalizat").length,
      };
    })
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
      {statsByProject.length ? (
        <div className="space-y-6">
          {statsByProject.map(({ project, total, de_facut, in_lucru, finalizat }) => (
            <section key={project.id} className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-800">{project.name}</h2>
                <Link
                  href={`/admin/proiecte/${project.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Deschide proiect
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg border p-3">
                  <p className="text-sm text-slate-600">Total puncte</p>
                  <p className="text-xl font-bold text-slate-800">{total}</p>
                  <p className="text-xs text-slate-500 mt-0.5">unice (cod nr)</p>
                </div>
                <div className="bg-blue-50 rounded-lg border border-blue-200 p-3">
                  <p className="text-sm text-blue-700">De făcut</p>
                  <p className="text-xl font-bold text-blue-800">{de_facut}</p>
                </div>
                <div className="bg-amber-50 rounded-lg border border-amber-200 p-3">
                  <p className="text-sm text-amber-700">În lucru</p>
                  <p className="text-xl font-bold text-amber-800">{in_lucru}</p>
                </div>
                <div className="bg-green-50 rounded-lg border border-green-200 p-3">
                  <p className="text-sm text-green-700">Finalizat</p>
                  <p className="text-xl font-bold text-green-800">{finalizat}</p>
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="text-slate-500">Niciun proiect. Creează unul din Proiecte.</p>
      )}
    </div>
  );
}
