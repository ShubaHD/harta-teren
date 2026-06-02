import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";

export default async function VizitatoriListPage() {
  const supabase = createServiceClient();
  const { data: allProjects } = await supabase
    .from("projects")
    .select("id, name")
    .order("name");

  // Ascunde "Proiect implicit" (nu mai există ca proiect real)
  const IMPLICIT_PROJECT_ID = "00000000-0000-0000-0000-000000000001";
  const projects = allProjects?.filter((p) => p.id !== IMPLICIT_PROJECT_ID) ?? [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-xl font-bold text-slate-800 mb-2">Vizitatori</h1>
        <p className="text-sm text-slate-600 mb-6">
          Selectează un proiect pentru a vedea progresul forajelor în timp real.
        </p>
        <ul className="space-y-2">
          {projects?.map((p) => (
            <li key={p.id}>
              <Link
                href={`/vizitatori/${p.id}`}
                className="block px-4 py-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
              >
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
        {(!projects || projects.length === 0) && (
          <p className="text-slate-500 text-sm">Nu există proiecte.</p>
        )}
      </div>
    </div>
  );
}
