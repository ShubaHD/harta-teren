import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Acces interzis" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";
  const projectIds = Array.isArray(body.projectIds)
    ? body.projectIds.filter((id: unknown) => typeof id === "string")
    : [];

  if (!userId) return NextResponse.json({ error: "userId obligatoriu" }, { status: 400 });

  try {
    const admin = createServiceClient();
    const { error: delError } = await admin.from("project_access").delete().eq("user_id", userId);
    if (delError) return NextResponse.json({ error: delError.message }, { status: 400 });

    if (projectIds.length > 0) {
      const { error: insError } = await admin.from("project_access").insert(
        projectIds.map((project_id: string) => ({ user_id: userId, project_id }))
      );
      if (insError) return NextResponse.json({ error: insError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, restricted: projectIds.length > 0 });
  } catch {
    return NextResponse.json({ error: "Eroare la salvare" }, { status: 500 });
  }
}
