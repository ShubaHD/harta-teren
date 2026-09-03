-- Fișă PDF extra per foraj (pozele sunt deja în PDF).
-- Nu modifică drill_points, borehole_photos sau exportul existent.
-- Poți rula de mai multe ori (idempotent).

CREATE TABLE IF NOT EXISTS field_site_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drill_point_id UUID NOT NULL REFERENCES drill_points(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'pdf' CHECK (kind = 'pdf'),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_field_site_files_one_pdf
  ON field_site_files(drill_point_id);

ALTER TABLE field_site_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_field_site_files" ON field_site_files;
CREATE POLICY "public_read_field_site_files"
  ON field_site_files FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "admin_insert_field_site_files" ON field_site_files;
CREATE POLICY "admin_insert_field_site_files"
  ON field_site_files FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "admin_update_field_site_files" ON field_site_files;
CREATE POLICY "admin_update_field_site_files"
  ON field_site_files FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "admin_delete_field_site_files" ON field_site_files;
CREATE POLICY "admin_delete_field_site_files"
  ON field_site_files FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'field-site-files',
  'field-site-files',
  true,
  83886080,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "field_site_files_storage_select" ON storage.objects;
CREATE POLICY "field_site_files_storage_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'field-site-files');

DROP POLICY IF EXISTS "field_site_files_storage_insert" ON storage.objects;
CREATE POLICY "field_site_files_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'field-site-files'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "field_site_files_storage_update" ON storage.objects;
CREATE POLICY "field_site_files_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'field-site-files'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "field_site_files_storage_delete" ON storage.objects;
CREATE POLICY "field_site_files_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'field-site-files'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
