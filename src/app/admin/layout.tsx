import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/mapa");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b shrink-0">
        <nav className="flex items-center gap-4">
          <Link href="/admin" className="font-semibold text-slate-800">
            Admin
          </Link>
          <Link href="/admin/proiecte" className="text-sm text-slate-600 hover:text-blue-600">
            Proiecte
          </Link>
          <Link href="/admin/echipe" className="text-sm text-slate-600 hover:text-blue-600">
            Echipe
          </Link>
          <Link href="/mapa" className="text-sm text-slate-600 hover:text-blue-600">
            Hartă
          </Link>
          <Link href="/vizitatori" target="_blank" className="text-sm text-slate-600 hover:text-blue-600">
            Vizitatori
          </Link>
        </nav>
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-sm text-slate-600 hover:text-slate-800">
            Ieșire
          </button>
        </form>
      </header>
      <main className="flex-1 p-4 overflow-auto">{children}</main>
    </div>
  );
}
