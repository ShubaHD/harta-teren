import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Acces interzis" }, { status: 403 });

  const { userId, newPassword } = await req.json();
  if (!userId || !newPassword || newPassword.length < 4) {
    return NextResponse.json({ error: "Parolă invalidă (min. 4 caractere)" }, { status: 400 });
  }

  try {
    const admin = createServiceClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Eroare la resetare parolă" }, { status: 500 });
  }
}
