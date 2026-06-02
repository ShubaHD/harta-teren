export type DrillPointStatus = "de_facut" | "in_lucru" | "finalizat";

export interface Project {
  id: string;
  name: string;
  topic?: string | null;
  location?: string | null;
  client?: string | null;
  description?: string | null;
  created_at: string;
}

/** Tipuri instalație foraj */
export const TIP_INSTALATIE_OPTIONS = [
  "Rolatec RL 46",
  "Rolatec RL 48",
  "Rolatec RL 400",
  "Rolatec RL 800",
  "Tecoinsa Tp30",
  "Tecoinsa Tp50",
  "Tecoinsa Tp60",
] as const;

/** Tipuri penetrare dinamică – DPSH interval 20cm, DPM/DPL/DPH interval 10cm */
export const TIP_PENETRARE_DINAMICA_OPTIONS = ["DPSH", "DPM", "DPL", "DPH"] as const;
export type TipPenetrareDinamica = (typeof TIP_PENETRARE_DINAMICA_OPTIONS)[number];

/** Categorii foraj pentru iconițe pe hartă (din Fișa Foraj) */
export const CATEGORIE_FORAJ_OPTIONS = [
  "General",
  "Structuri",
  "Drum",
  "Parcări",
  "Explorare",
  "Reabilitare",
] as const;

export interface DrillPoint {
  id: string;
  project_id: string;
  code: string;
  lat: number;
  lng: number;
  status: DrillPointStatus;
  assigned_team: string | null;
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  final_depth: string | null;
  notes: string | null;
  /** Adâncime propusă din CSV-ul inițial (raportare) */
  adancime_propusa?: string | null;
  /** Câmpuri din Fișa Foraj */
  kilometraj?: string | null;
  tip_instalatie?: string | null;
  intocmit?: string | null;
  categorie_foraj?: string | null;
  water_during?: string | null;
  water_after_24h?: string | null;
  elevation_h?: string | null;
  /** DPSH, DPM, DPL, DPH – determină fișa de penetrare dinamică */
  tip_penetrare_dinamica?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  role: "admin" | "team";
  team_name: string | null;
}

/** Tipuri litologice (geotehnic) */
export const LITHOLOGY_TYPE_OPTIONS = [
  "Argila",
  "Argila prafoasa",
  "Argila nisipoasa",
  "Praf",
  "Praf argilos",
  "Nisip",
  "Nisip prafos",
  "Nisip argilos",
  "Nisip cu pietris",
  "Pietris cu nisip",
  "Blocuri si bolovanisuri",
  "Argila Marnoasa",
  "Roca",
  "Roca alterata",
  "Sol vegetal",
  "Turba",
  "Carbune",
  "Scoici",
  "Umplutura",
] as const;

/** Consistență (argile, praf argilos) – tipuri coezive */
export const LITHOLOGY_CONSISTENCY_OPTIONS = [
  "Plastic foarte moale",
  "Plastic moale",
  "Plastic mediu",
  "Plastic tare",
  "Plastic foarte tare",
] as const;

/** Indesare Necoeziv (nisipuri, pietriș) – tipuri necoezive */
export const LITHOLOGY_INDESARE_OPTIONS = [
  "Foarte afânat",
  "Afanat",
  "Mediu indesat",
  "Indesat",
  "Foarte Indesat",
] as const;

/** Tipuri care afișează Consistență */
export const LITHOLOGY_TYPES_CONSISTENCY = [
  "Argila Marnoasa",
  "Argila",
  "Argila prafoasa",
  "Argila nisipoasa",
  "Praf",
  "Praf argilos",
] as const;

/** Tipuri care afișează Indesare Necoeziv */
export const LITHOLOGY_TYPES_INDESARE = [
  "Nisip",
  "Nisip prafos",
  "Nisip argilos",
  "Nisip cu pietris",
  "Pietris cu nisip",
  "Blocuri si bolovanisuri",
] as const;

/** Tipuri fără Consistență/Indesare (Roca) */
export const LITHOLOGY_TYPES_ROCK = ["Roca", "Roca alterata"] as const;

/** Culori litologie */
export const LITHOLOGY_COLOR_OPTIONS = [
  "Brun/Maroniu",
  "Cafeniu/Brun galbui",
  "Cenusiu",
  "Cenusiu albatrui",
  "Negricios",
  "Brun negricios",
  "Cenusiu verzui",
  "Brun rosiatic",
] as const;

export interface LithologyInterval {
  id: string;
  drill_point_id: string;
  from_m: number;
  to_m: number;
  type: string | null;
  consistency: string | null;
  color: string | null;
  sand_compaction: string | null;
  water_during: string | null;
  water_after_24h: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Tipuri probă */
export const SAMPLE_TYPE_OPTIONS = [
  "Tulburata",
  "Shelby",
  "Netulburata",
  "SPT",
  "APA",
] as const;

/** Tipuri echipare */
export const EQUIPMENT_TYPE_OPTIONS = [
  "Inclinometrica",
  "Piezometru Tub Riflat",
  "Piezometru Tub Plin",
  "Tubaj/Casing",
] as const;

export interface Equipment {
  id: string;
  drill_point_id: string;
  from_m: number;
  to_m: number;
  type: string;
  created_at: string;
  updated_at: string;
}

export interface Sample {
  id: string;
  drill_point_id: string;
  depth_m: number;
  type: string;
  spt_values: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Tipuri piston pentru Pocket Penetrometru */
export const POCKET_PENETROMETER_PLUNGER_OPTIONS = [
  { value: "6.35", label: "6.35 mm (0.25 inch) — piston standard" },
  { value: "25", label: "25 mm (1 inch) — adaptor pentru sol foarte moale" },
] as const;

export interface PocketPenetrometer {
  id: string;
  drill_point_id: string;
  from_m: number;
  to_m: number;
  plunger: string;
  valori: string;
  created_at: string;
  updated_at: string;
}

/** Diametre vane și factori de corecție (Su = citire × factor) */
export const POCKET_VANE_OPTIONS = [
  { value: "25.4", label: "25.4 mm (mare) — argile foarte moi", factor: 0.49 },
  { value: "20", label: "20 mm (standard) — argile moi–medii", factor: 1.0 },
  { value: "16", label: "16 mm (mică) — argile mai tari", factor: 1.95 },
] as const;

export interface PocketVaneTest {
  id: string;
  drill_point_id: string;
  from_m: number;
  to_m: number;
  value_kg_cm2: number;
  vane_diameter: string;
  test_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface RqdTcrScr {
  id: string;
  drill_point_id: string;
  from_m: number;
  to_m: number;
  carota_gt_10cm: string;
  total_recovered_cm: number | null;
  created_at: string;
  updated_at: string;
}

export interface DynamicPenetrationInterval {
  id: string;
  drill_point_id: string;
  from_m: number;
  to_m: number;
  blows: number;
  created_at: string;
  updated_at: string;
}

export interface BoreholePhoto {
  id: string;
  drill_point_id: string;
  title: string;
  storage_path: string;
  rotation: number;
  created_at: string;
  updated_at: string;
}
