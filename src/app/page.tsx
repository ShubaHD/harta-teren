import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "@/components/LoginForm";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "admin") {
      redirect("/admin");
    }
    redirect("/mapa");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-slate-100 to-slate-200">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">
          Harta Teren
        </h1>
        <p className="text-center text-slate-600 mb-6 text-sm">
          Puncte de foraj
        </p>
        <LoginForm />
        <p className="mt-4 text-center">
          <Link href="/vizitatori" className="text-sm text-blue-600 hover:underline">
            Vizitatori / Beneficiari →
          </Link>
        </p>
      </div>
    </main>
  );
}
