-- Permite tuturor (inclusiv vizitatorilor anonimi) să vadă și să adauge semne/text

DROP POLICY IF EXISTS "auth_read_annotations" ON map_annotations;
CREATE POLICY "public_read_annotations" ON map_annotations FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "auth_insert_annotations" ON map_annotations;
CREATE POLICY "public_insert_annotations" ON map_annotations FOR INSERT
  WITH CHECK (true);

-- Ștergere: oricine poate șterge annotații anonime (created_by null), sau proprietarul/admin
DROP POLICY IF EXISTS "auth_delete_annotations" ON map_annotations;
CREATE POLICY "public_delete_annotations" ON map_annotations FOR DELETE
  USING (
    created_by IS NULL
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
