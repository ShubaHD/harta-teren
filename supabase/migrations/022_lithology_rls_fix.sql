-- Fix RLS: permite echipei să adauge litologie și la puncte finalizate (ca 010 și celelalte tabele)
DROP POLICY IF EXISTS "auth_manage_lithology" ON lithology_intervals;
CREATE POLICY "auth_manage_lithology" ON lithology_intervals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM drill_points dp
      WHERE dp.id = lithology_intervals.drill_point_id
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
      WHERE dp.id = lithology_intervals.drill_point_id
      AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat'
        OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())
      )
    )
  );
