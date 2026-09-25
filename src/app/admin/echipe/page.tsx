import { createServiceClient } from "@/lib/supabase/service";
import CreateTeam from "@/components/CreateTeam";
import ResetTeamPasswordButton from "@/components/ResetTeamPasswordButton";
import DeleteTeamButton from "@/components/DeleteTeamButton";
import TeamProjectAccess from "@/components/TeamProjectAccess";

export default async function EchipePage() {
  const supabase = createServiceClient();
  const [{ data: profiles }, { data: projects }, accessRes] = await Promise.all([
    supabase.from("profiles").select("id, email, team_name, created_at").eq("role", "team").order("team_name"),
    supabase.from("projects").select("id, name").order("name"),
    supabase.from("project_access").select("user_id, project_id"),
  ]);
  const accessRows = accessRes.error ? [] : (accessRes.data ?? []);

  const assignedByUser = (accessRows ?? []).reduce(
    (acc, row) => {
      if (!row.user_id || !row.project_id) return acc;
      acc[row.user_id] = [...(acc[row.user_id] ?? []), row.project_id];
      return acc;
    },
    {} as Record<string, string[]>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Echipe</h1>
        <CreateTeam />
      </div>
      <section className="bg-white rounded-lg border overflow-hidden">
        <p className="px-4 py-2 text-sm text-slate-600 border-b">
          Echipele se autentifică cu emailul de mai jos și parola setată la creare.
          La „Acces proiecte”: <strong>Toate</strong> = vede tot; bifează doar unele proiecte pentru un cont (ex. FCC).
        </p>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-700">Nume echipă</th>
              <th className="px-4 py-2 text-left font-medium text-slate-700">Email (login)</th>
              <th className="px-4 py-2 text-left font-medium text-slate-700">Acces proiecte</th>
              <th className="px-4 py-2 text-left font-medium text-slate-700">Creat</th>
              <th className="px-4 py-2 text-right font-medium text-slate-700">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {profiles?.map((p) => (
              <tr key={p.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-2 font-medium">{p.team_name ?? "—"}</td>
                <td className="px-4 py-2 font-mono text-slate-600">{p.email ?? "—"}</td>
                <td className="px-4 py-2">
                  <TeamProjectAccess
                    userId={p.id}
                    teamName={p.team_name ?? p.email ?? "echipă"}
                    projects={projects ?? []}
                    assignedIds={assignedByUser[p.id] ?? []}
                  />
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {p.created_at ? new Date(p.created_at).toLocaleDateString("ro") : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  <ResetTeamPasswordButton userId={p.id} teamName={p.team_name ?? p.email ?? "echipă"} />
                  <DeleteTeamButton userId={p.id} teamName={p.team_name ?? p.email ?? "echipă"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
