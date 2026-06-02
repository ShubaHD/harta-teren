/**
 * Script pentru crearea utilizatorilor inițiali în Supabase.
 * Rulează cu: npm run seed:users
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config({ path: "env.local.template" });
config({ path: ".env.local/env.local.template" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const users = [
  { email: "echipa1@harta.local", password: "echipa1", role: "team", team_name: "echipa1" },
  { email: "echipa2@harta.local", password: "echipa2", role: "team", team_name: "echipa2" },
  { email: "echipa3@harta.local", password: "echipa3", role: "team", team_name: "echipa3" },
  { email: "admin@harta.local", password: "Calan2025", role: "admin", team_name: null },
];

async function main() {
  const { data: list } = await supabase.auth.admin.listUsers();
  const byEmail = new Map(list.users.map((x) => [x.email?.toLowerCase(), x]));

  for (const u of users) {
    const existing = byEmail.get(u.email.toLowerCase());
    if (existing) {
      const { error } = await supabase.auth.admin.updateUserById(existing.id, {
        password: u.password,
        user_metadata: { role: u.role, team_name: u.team_name },
      });
      if (error) {
        console.error(`${u.email} (update):`, error.message);
      } else {
        console.log(`✓ ${u.email} – parolă actualizată`);
      }
      // Sincronizează profilul (role poate fi greșit dacă userul a fost creat înainte)
      const { error: profileErr } = await supabase.from("profiles").upsert(
        {
          id: existing.id,
          email: u.email,
          role: u.role,
          team_name: u.team_name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
      if (profileErr) {
        console.error(`${u.email} (profil):`, profileErr.message);
      }
    } else {
      const { data: newUser, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { role: u.role, team_name: u.team_name },
      });
      if (error) {
        console.error(`${u.email}:`, error.message);
      } else {
        console.log(`✓ Creat: ${u.email}`);
        if (newUser?.user) {
          await supabase.from("profiles").upsert(
            {
              id: newUser.user.id,
              email: u.email,
              role: u.role,
              team_name: u.team_name,
            },
            { onConflict: "id" }
          );
        }
      }
    }
  }
}

main();
