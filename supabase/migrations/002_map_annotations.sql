-- Annotații pe hartă: linii, săgeți, semne, text
-- Obligatoriu pe proiectul Supabase (ex. Vercel) – fără acest tabel apare 404 la /rest/v1/map_annotations
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

-- Pentru sincronizare în timp real: rulează în SQL Editor dacă vrei:
-- ALTER PUBLICATION supabase_realtime ADD TABLE map_annotations;
