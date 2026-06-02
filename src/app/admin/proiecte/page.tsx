import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CreateProject from "@/components/CreateProject";
import DeleteProjectButton from "@/components/DeleteProjectButton";

export default async function ProiectePage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  const { data: pointCounts } = await supabase
    .from("drill_points")
    .select("project_id")
    .limit(50000);
  const countByProject = (pointCounts ?? []).reduce(
    (acc, p) => {
      if (p?.project_id == null) return acc;
      const pid = String(p.project_id);
      acc[pid] = (acc[pid] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Proiecte</h1>
        <CreateProject />
      </div>
      <section className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-700">Nume</th>
              <th className="px-4 py-2 text-left font-medium text-slate-700">Creat</th>
              <th className="px-4 py-2 text-right font-medium text-slate-700">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {projects?.map((p) => (
              <tr key={p.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-2 font-medium">{p.name}</td>
                <td className="px-4 py-2 text-slate-600">
                  {new Date(p.created_at).toLocaleDateString("ro")}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/admin/proiecte/${p.id}`}
                    className="text-blue-600 hover:underline mr-2"
                  >
                    Deschide
                  </Link>
                  <Link
                    href={`/vizitatori/${p.id}`}
                    target="_blank"
                    className="text-slate-500 hover:underline text-xs mr-2"
                  >
                    Link vizitatori
                  </Link>
                  <DeleteProjectButton
                    projectId={p.id}
                    projectName={p.name}
                    pointsCount={countByProject[String(p.id)] ?? 0}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
