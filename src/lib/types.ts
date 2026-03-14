export type DrillPointStatus = "de_facut" | "in_lucru" | "finalizat";

export interface Project {
  id: string;
  name: string;
  created_at: string;
}

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
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  role: "admin" | "team";
  team_name: string | null;
}
