import { createServiceClient } from "@/lib/supabase/service";
import CreateTeam from "@/components/CreateTeam";
import ResetTeamPasswordButton from "@/components/ResetTeamPasswordButton";
import DeleteTeamButton from "@/components/DeleteTeamButton";

export default async function EchipePage() {
  const supabase = createServiceClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, team_name, created_at")
    .eq("role", "team")
    .order("team_name");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Echipe</h1>
        <CreateTeam />
      </div>
      <section className="bg-white rounded-lg border overflow-hidden">
        <p className="px-4 py-2 text-sm text-slate-600 border-b">
          Echipele se autentifică cu emailul de mai jos și parola setată la creare.
        </p>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-700">Nume echipă</th>
              <th className="px-4 py-2 text-left font-medium text-slate-700">Email (login)</th>
              <th className="px-4 py-2 text-left font-medium text-slate-700">Creat</th>
              <th className="px-4 py-2 text-right font-medium text-slate-700">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {profiles?.map((p) => (
              <tr key={p.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-2 font-medium">{p.team_name ?? "—"}</td>
                <td className="px-4 py-2 font-mono text-slate-600">{p.email ?? "—"}</td>
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
