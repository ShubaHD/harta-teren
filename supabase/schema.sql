-- Harta Teren - Schema completă pentru Supabase
-- Rulează în Supabase: Dashboard → SQL Editor → New query → paste → Run
-- (Pe un proiect existent, unele comenzi pot da erori „already exists” – poți ignora sau rula doar secțiunile care lipsesc.)

-- ========== Extensii ==========
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== Tabel profiles ==========
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'team')),
  team_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;
CREATE POLICY "users_insert_own_profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ========== Tabel projects ==========
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  topic TEXT,
  location TEXT,
  client TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_projects" ON projects;
CREATE POLICY "admin_all_projects" ON projects FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "teams_read_projects" ON projects;
CREATE POLICY "teams_read_projects" ON projects FOR SELECT
  USING (true);

-- Proiect implicit (opțional, dacă ai puncte fără proiect)
INSERT INTO projects (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Proiect implicit')
ON CONFLICT (id) DO NOTHING;

-- ========== Tabel drill_points ==========
CREATE TABLE IF NOT EXISTS drill_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  code TEXT NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'de_facut' CHECK (status IN ('de_facut', 'in_lucru', 'finalizat')),
  assigned_team TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cod unic per proiect (același cod poate exista în proiecte diferite)
ALTER TABLE drill_points DROP CONSTRAINT IF EXISTS drill_points_code_key;
DROP INDEX IF EXISTS drill_points_project_code_unique;
CREATE UNIQUE INDEX IF NOT EXISTS drill_points_project_code_unique ON drill_points(project_id, code);

CREATE INDEX IF NOT EXISTS idx_drill_points_status ON drill_points(status);
CREATE INDEX IF NOT EXISTS idx_drill_points_assigned_team ON drill_points(assigned_team);
CREATE INDEX IF NOT EXISTS idx_drill_points_project ON drill_points(project_id);

ALTER TABLE drill_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_all_points" ON drill_points;
CREATE POLICY "admin_read_all_points" ON drill_points
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "teams_read_points" ON drill_points;
CREATE POLICY "teams_read_points" ON drill_points
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'team'));

DROP POLICY IF EXISTS "admin_insert_points" ON drill_points;
CREATE POLICY "admin_insert_points" ON drill_points
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "admin_update_all_points" ON drill_points;
CREATE POLICY "admin_update_all_points" ON drill_points
  FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "admin_delete_points" ON drill_points;
CREATE POLICY "admin_delete_points" ON drill_points
  FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "teams_update_points" ON drill_points;
CREATE POLICY "teams_update_points" ON drill_points
  FOR UPDATE
  USING (
    status = 'de_facut'
    OR (
      status IN ('in_lucru', 'finalizat')
      AND (
        LOWER(TRIM(COALESCE(assigned_team, ''))) = LOWER(TRIM(COALESCE((SELECT team_name FROM profiles WHERE id = auth.uid()), '')))
        OR TRIM(COALESCE(assigned_team, '')) = ''
      )
    )
  )
  WITH CHECK (true);

-- ========== Tabel map_annotations (linii, săgeți, semne pe hartă) ==========
CREATE TABLE IF NOT EXISTS map_annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('line', 'arrow', 'marker', 'text')),
  geom JSONB NOT NULL,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_map_annotations_project ON map_annotations(project_id);

ALTER TABLE map_annotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_annotations" ON map_annotations;
DROP POLICY IF EXISTS "auth_insert_annotations" ON map_annotations;
DROP POLICY IF EXISTS "auth_update_annotations" ON map_annotations;
DROP POLICY IF EXISTS "auth_delete_annotations" ON map_annotations;

CREATE POLICY "auth_read_annotations" ON map_annotations FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()));

CREATE POLICY "auth_insert_annotations" ON map_annotations FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()));

CREATE POLICY "auth_update_annotations" ON map_annotations FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "auth_delete_annotations" ON map_annotations FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ========== Trigger: profil la signup ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, team_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'team'),
    NEW.raw_user_meta_data->>'team_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
