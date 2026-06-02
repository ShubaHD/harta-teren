-- Rulează acest script în Supabase: Dashboard → SQL Editor → New query → paste → Run
-- Creează tabelul map_annotations (linii, săgeți, semne) dacă lipsește.

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

-- Elimină politicile vechi dacă există (pentru a evita erori la recreare)
DROP POLICY IF EXISTS "auth_read_annotations" ON map_annotations;
DROP POLICY IF EXISTS "auth_insert_annotations" ON map_annotations;
DROP POLICY IF EXISTS "auth_update_annotations" ON map_annotations;
DROP POLICY IF EXISTS "auth_delete_annotations" ON map_annotations;
DROP POLICY IF EXISTS "public_read_annotations" ON map_annotations;
DROP POLICY IF EXISTS "public_insert_annotations" ON map_annotations;
DROP POLICY IF EXISTS "public_delete_annotations" ON map_annotations;

-- Utilizatorii autentificați (cu profil) pot citi și insera annotații
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
