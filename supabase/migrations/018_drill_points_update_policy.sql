-- Permite echipelor să actualizeze punctele asignate și când status = finalizat (pentru corectări Date foraj)
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
