/**
 * Verifică dacă utilizatorii există în Supabase Auth.
 * Rulează: npx tsx scripts/check-users.ts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config({ path: "env.local.template" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL și SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Eroare:", error.message);
    process.exit(1);
  }
  console.log("Utilizatori în Supabase Auth:");
  data.users.forEach((u) => {
    console.log(`  - ${u.email} (confirmat: ${u.email_confirmed_at ? "da" : "nu"})`);
  });
  if (data.users.length === 0) {
    console.log("\nNiciun utilizator. Rulează: npm run seed:users");
  }
}

main();
