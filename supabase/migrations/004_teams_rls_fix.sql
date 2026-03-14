-- Comparare team_name insensibilă la majuscule și spații pentru RLS

DROP POLICY IF EXISTS "teams_read_points" ON drill_points;
CREATE POLICY "teams_read_points" ON drill_points
  FOR SELECT USING (
    status != 'finalizat'
    OR LOWER(TRIM(COALESCE(assigned_team, ''))) = LOWER(TRIM(COALESCE((SELECT team_name FROM profiles WHERE id = auth.uid()), '')))
  );

DROP POLICY IF EXISTS "teams_update_points" ON drill_points;
CREATE POLICY "teams_update_points" ON drill_points
  FOR UPDATE
  USING (
    status = 'de_facut'
    OR (
      status = 'in_lucru'
      AND (
        LOWER(TRIM(COALESCE(assigned_team, ''))) = LOWER(TRIM(COALESCE((SELECT team_name FROM profiles WHERE id = auth.uid()), '')))
        OR TRIM(COALESCE(assigned_team, '')) = ''
      )
    )
  )
  WITH CHECK (true);
