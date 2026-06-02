-- Tabel pentru metadata poze (imaginea în Storage)
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

CREATE POLICY "auth_read_borehole_photos" ON borehole_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drill_points dp
      WHERE dp.id = borehole_photos.drill_point_id
      AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR (dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid()))
      )
    )
  );

CREATE POLICY "auth_manage_borehole_photos" ON borehole_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM drill_points dp
      WHERE dp.id = borehole_photos.drill_point_id
      AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat'
        OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM drill_points dp
      WHERE dp.id = borehole_photos.drill_point_id
      AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat'
        OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())
      )
    )
  );

-- Bucket Storage pentru poze
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'borehole-photos',
  'borehole-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Politici Storage: utilizatori autentificați pot uploada/selecta/șterge în borehole-photos
CREATE POLICY "borehole_photos_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'borehole-photos');

CREATE POLICY "borehole_photos_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'borehole-photos');

CREATE POLICY "borehole_photos_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'borehole-photos');

CREATE POLICY "borehole_photos_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'borehole-photos');
