-- Echipele pot vedea și punctele finalizate (afișate verde, ca la admin), nu doar cele de făcut/în lucru
DROP POLICY IF EXISTS "teams_read_points" ON drill_points;
CREATE POLICY "teams_read_points" ON drill_points
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'team')
  );
