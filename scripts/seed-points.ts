/**
 * Script pentru adăugarea punctelor de test.
 * Rulează: npm run seed:points
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config({ path: "env.local.template" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (sau ANON pentru admin login)");
  process.exit(1);
}

const supabase = createClient(url, key);

const DEFAULT_PROJECT_ID = "00000000-0000-0000-0000-000000000001";

const samplePoints = [
  { code: "P001", lat: 45.9432, lng: 24.9668 },
  { code: "P002", lat: 45.9445, lng: 24.9680 },
  { code: "P003", lat: 45.9458, lng: 24.9692 },
  { code: "P004", lat: 45.9470, lng: 24.9705 },
  { code: "P005", lat: 45.9482, lng: 24.9718 },
];

async function main() {
  const toInsert = samplePoints.map((p) => ({
    ...p,
    project_id: DEFAULT_PROJECT_ID,
  }));
  const { data, error } = await supabase.from("drill_points").insert(toInsert).select("id");
  if (error) {
    console.error("Eroare:", error.message);
    process.exit(1);
  }
  console.log(`✓ Adăugate ${data?.length ?? 0} puncte`);
}

main();
