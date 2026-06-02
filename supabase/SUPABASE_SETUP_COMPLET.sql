-- =============================================================================
-- Harta Teren - Setup complet Supabase
-- Rulează acest fișier în Supabase SQL Editor (în ordinea secțiunilor)
-- =============================================================================

-- ========== 1. SCHEMA INIȚIALĂ (schema.sql) ==========
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'team')),
  team_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drill points
CREATE TABLE IF NOT EXISTS drill_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE INDEX IF NOT EXISTS idx_drill_points_status ON drill_points(status);
CREATE INDEX IF NOT EXISTS idx_drill_points_assigned_team ON drill_points(assigned_team);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drill_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_insert_own_profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "admin_read_all_points" ON drill_points FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "teams_read_points" ON drill_points FOR SELECT USING (
  status != 'finalizat' OR assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "admin_insert_points" ON drill_points FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_update_all_points" ON drill_points FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "teams_update_points" ON drill_points FOR UPDATE USING (
  status = 'de_facut' OR (status = 'in_lucru' AND assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid()))
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, team_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'role', 'team'), NEW.raw_user_meta_data->>'team_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== 2. PROIECTE ȘI ECHIPE (001) ==========
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO projects (id, name) VALUES 
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Proiect implicit')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
UPDATE drill_points SET project_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE project_id IS NULL;
ALTER TABLE drill_points ALTER COLUMN project_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
CREATE INDEX IF NOT EXISTS idx_drill_points_project ON drill_points(project_id);

ALTER TABLE drill_points DROP CONSTRAINT IF EXISTS drill_points_code_key;
DROP INDEX IF EXISTS drill_points_project_code_unique;
CREATE UNIQUE INDEX IF NOT EXISTS drill_points_project_code_unique ON drill_points(project_id, code);

CREATE POLICY "admin_delete_points" ON drill_points FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_projects" ON projects FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "teams_read_projects" ON projects FOR SELECT USING (true);

DROP POLICY IF EXISTS "teams_read_points" ON drill_points;
CREATE POLICY "teams_read_points" ON drill_points FOR SELECT USING (
  status != 'finalizat' OR assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())
);

-- ========== 3. MAP ANNOTATIONS (002, 003) ==========
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
CREATE POLICY "public_read_annotations" ON map_annotations FOR SELECT USING (true);
DROP POLICY IF EXISTS "auth_insert_annotations" ON map_annotations;
CREATE POLICY "public_insert_annotations" ON map_annotations FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_annotations" ON map_annotations;
CREATE POLICY "public_delete_annotations" ON map_annotations FOR DELETE USING (
  created_by IS NULL OR created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "auth_update_annotations" ON map_annotations;
CREATE POLICY "auth_update_annotations" ON map_annotations FOR UPDATE USING (
  created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ========== 4. TEAMS RLS FIX (004) ==========
DROP POLICY IF EXISTS "teams_read_points" ON drill_points;
CREATE POLICY "teams_read_points" ON drill_points FOR SELECT USING (
  status != 'finalizat'
  OR LOWER(TRIM(COALESCE(assigned_team, ''))) = LOWER(TRIM(COALESCE((SELECT team_name FROM profiles WHERE id = auth.uid()), '')))
);

DROP POLICY IF EXISTS "teams_update_points" ON drill_points;
CREATE POLICY "teams_update_points" ON drill_points FOR UPDATE
  USING (
    status = 'de_facut'
    OR (status IN ('in_lucru', 'finalizat')
      AND (LOWER(TRIM(COALESCE(assigned_team, ''))) = LOWER(TRIM(COALESCE((SELECT team_name FROM profiles WHERE id = auth.uid()), '')))
        OR TRIM(COALESCE(assigned_team, '')) = ''))
  )
  WITH CHECK (true);

-- ========== 5. FINAL DEPTH (005) ==========
ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS final_depth TEXT;

-- ========== 6. ADMIN READ PROFILES (006) ==========
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "admin_read_all_profiles" ON profiles FOR SELECT USING (public.is_admin());

-- ========== 7. BOREHOLE FIELDS ȘI PROIECTE (007) ==========
ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS kilometraj TEXT;
ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS tip_instalatie TEXT;
ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS intocmit TEXT;
ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS categorie_foraj TEXT;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;

-- ========== 8. LITOLOGIE (008) ==========
CREATE TABLE IF NOT EXISTS lithology_intervals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drill_point_id UUID NOT NULL REFERENCES drill_points(id) ON DELETE CASCADE,
  from_m NUMERIC NOT NULL,
  to_m NUMERIC NOT NULL,
  type TEXT,
  consistency TEXT,
  color TEXT,
  sand_compaction TEXT,
  water_during TEXT,
  water_after_24h TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lithology_drill_point ON lithology_intervals(drill_point_id);
ALTER TABLE lithology_intervals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_lithology" ON lithology_intervals;
CREATE POLICY "auth_read_lithology" ON lithology_intervals FOR SELECT USING (
  EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = lithology_intervals.drill_point_id
    AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      OR (dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid()))))
);

DROP POLICY IF EXISTS "auth_manage_lithology" ON lithology_intervals;
CREATE POLICY "auth_manage_lithology" ON lithology_intervals FOR ALL
  USING (
    EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = lithology_intervals.drill_point_id
      AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = lithology_intervals.drill_point_id
      AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())))
  );

-- ========== 9. PROBE (009) ==========
CREATE TABLE IF NOT EXISTS samples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drill_point_id UUID NOT NULL REFERENCES drill_points(id) ON DELETE CASCADE,
  depth_m NUMERIC NOT NULL,
  type TEXT NOT NULL,
  spt_values TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_samples_drill_point ON samples(drill_point_id);
ALTER TABLE samples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_samples" ON samples;
CREATE POLICY "auth_read_samples" ON samples FOR SELECT USING (
  EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = samples.drill_point_id
    AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      OR (dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid()))))
);

DROP POLICY IF EXISTS "auth_manage_samples" ON samples;
CREATE POLICY "auth_manage_samples" ON samples FOR ALL
  USING (
    EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = samples.drill_point_id
      AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = samples.drill_point_id
      AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())))
  );

-- ========== 10. WATER LEVEL (011) ==========
ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS water_during TEXT;
ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS water_after_24h TEXT;

-- ========== 11. ELEVATION H (012) ==========
ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS elevation_h TEXT;

-- ========== 12. ECHIPARE (013) ==========
CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drill_point_id UUID NOT NULL REFERENCES drill_points(id) ON DELETE CASCADE,
  from_m NUMERIC NOT NULL,
  to_m NUMERIC NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_equipment_drill_point ON equipment(drill_point_id);
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_equipment" ON equipment FOR SELECT USING (
  EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = equipment.drill_point_id
    AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      OR (dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid()))))
);

CREATE POLICY "auth_manage_equipment" ON equipment FOR ALL
  USING (
    EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = equipment.drill_point_id
      AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = equipment.drill_point_id
      AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())))
  );

-- ========== 13. POCKET PENETROMETER (014) ==========
CREATE TABLE IF NOT EXISTS pocket_penetrometer (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drill_point_id UUID NOT NULL REFERENCES drill_points(id) ON DELETE CASCADE,
  from_m NUMERIC NOT NULL,
  to_m NUMERIC NOT NULL,
  plunger TEXT NOT NULL,
  valori TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pocket_penetrometer_drill_point ON pocket_penetrometer(drill_point_id);
ALTER TABLE pocket_penetrometer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_pocket_penetrometer" ON pocket_penetrometer FOR SELECT USING (
  EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = pocket_penetrometer.drill_point_id
    AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      OR (dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid()))))
);

CREATE POLICY "auth_manage_pocket_penetrometer" ON pocket_penetrometer FOR ALL
  USING (
    EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = pocket_penetrometer.drill_point_id
      AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = pocket_penetrometer.drill_point_id
      AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())))
  );

-- ========== 14. POCKET VANE TEST (015) ==========
CREATE TABLE IF NOT EXISTS pocket_vane_test (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drill_point_id UUID NOT NULL REFERENCES drill_points(id) ON DELETE CASCADE,
  from_m NUMERIC NOT NULL,
  to_m NUMERIC NOT NULL,
  value_kg_cm2 NUMERIC NOT NULL,
  vane_diameter TEXT NOT NULL,
  test_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pocket_vane_test_drill_point ON pocket_vane_test(drill_point_id);
ALTER TABLE pocket_vane_test ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_pocket_vane_test" ON pocket_vane_test FOR SELECT USING (
  EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = pocket_vane_test.drill_point_id
    AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      OR (dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid()))))
);

CREATE POLICY "auth_manage_pocket_vane_test" ON pocket_vane_test FOR ALL
  USING (
    EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = pocket_vane_test.drill_point_id
      AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = pocket_vane_test.drill_point_id
      AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())))
  );

-- ========== 15. RQD, TCR, SCR (016) ==========
CREATE TABLE IF NOT EXISTS rqd_tcr_scr (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drill_point_id UUID NOT NULL REFERENCES drill_points(id) ON DELETE CASCADE,
  from_m NUMERIC NOT NULL,
  to_m NUMERIC NOT NULL,
  carota_gt_10cm TEXT NOT NULL,
  total_recovered_cm NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rqd_tcr_scr_drill_point ON rqd_tcr_scr(drill_point_id);
ALTER TABLE rqd_tcr_scr ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_rqd_tcr_scr" ON rqd_tcr_scr FOR SELECT USING (
  EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = rqd_tcr_scr.drill_point_id
    AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      OR (dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid()))))
);

CREATE POLICY "auth_manage_rqd_tcr_scr" ON rqd_tcr_scr FOR ALL
  USING (
    EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = rqd_tcr_scr.drill_point_id
      AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = rqd_tcr_scr.drill_point_id
      AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())))
  );

-- ========== 16. BOREHOLE PHOTOS + STORAGE (017) ==========
CREATE TABLE IF NOT EXISTS borehole_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drill_point_id UUID NOT NULL REFERENCES drill_points(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  rotation INT NOT NULL DEFAULT 0 CHECK (rotation IN (0, 90, 180, 270)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_borehole_photos_drill_point ON borehole_photos(drill_point_id);
ALTER TABLE borehole_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_borehole_photos" ON borehole_photos FOR SELECT USING (
  EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = borehole_photos.drill_point_id
    AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      OR (dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid()))))
);

CREATE POLICY "auth_manage_borehole_photos" ON borehole_photos FOR ALL
  USING (
    EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = borehole_photos.drill_point_id
      AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM drill_points dp WHERE dp.id = borehole_photos.drill_point_id
      AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())))
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('borehole-photos', 'borehole-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "borehole_photos_insert" ON storage.objects;
CREATE POLICY "borehole_photos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'borehole-photos');

DROP POLICY IF EXISTS "borehole_photos_select" ON storage.objects;
CREATE POLICY "borehole_photos_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'borehole-photos');

DROP POLICY IF EXISTS "borehole_photos_update" ON storage.objects;
CREATE POLICY "borehole_photos_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'borehole-photos');

DROP POLICY IF EXISTS "borehole_photos_delete" ON storage.objects;
CREATE POLICY "borehole_photos_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'borehole-photos');

-- ========== 17. DRILL POINTS UPDATE POLICY (018) ==========
-- (Politica teams_update_points a fost deja aplicată la pasul 4)

-- =============================================================================
-- FINALIZAT
-- După rulare, creează utilizatorii cu: npm run seed:users
-- =============================================================================
