-- Migrare: Proiecte, echipe, vizitatori
-- Rulează în Supabase SQL Editor după schema.sql inițială

-- 1. Tabel proiecte
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Proiect implicit pentru puncte existente
INSERT INTO projects (id, name) VALUES 
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Proiect implicit')
ON CONFLICT (id) DO NOTHING;

-- 3. Adaugă project_id la drill_points
ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
UPDATE drill_points SET project_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE project_id IS NULL;
ALTER TABLE drill_points ALTER COLUMN project_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
CREATE INDEX IF NOT EXISTS idx_drill_points_project ON drill_points(project_id);

-- 4. Constraint UNIQUE pe (project_id, code)
ALTER TABLE drill_points DROP CONSTRAINT IF EXISTS drill_points_code_key;
DROP INDEX IF EXISTS drill_points_project_code_unique;
CREATE UNIQUE INDEX drill_points_project_code_unique ON drill_points(project_id, code);

-- 5. Policy pentru ștergere (admin)
CREATE POLICY "admin_delete_points" ON drill_points
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. RLS pentru projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_projects" ON projects FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "teams_read_projects" ON projects FOR SELECT
  USING (true);

-- 7. Teams pot citi puncte (policy existent, fără modificare project)
DROP POLICY IF EXISTS "teams_read_points" ON drill_points;
CREATE POLICY "teams_read_points" ON drill_points
  FOR SELECT USING (
    status != 'finalizat'
    OR assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())
  );
