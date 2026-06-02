-- Litologie: intervale per foraj (fromM, toM, tip, consistență, culoare, compactare nisip)
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

-- Citire: utilizatorii care pot citi drill_point pot citi intervalele
CREATE POLICY "auth_read_lithology" ON lithology_intervals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drill_points dp
      WHERE dp.id = lithology_intervals.drill_point_id
      AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR (dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid()))
      )
    )
  );

-- Insert/Update/Delete: utilizatorii care pot actualiza drill_point
CREATE POLICY "auth_manage_lithology" ON lithology_intervals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM drill_points dp
      WHERE dp.id = lithology_intervals.drill_point_id
      AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR (dp.status = 'de_facut' OR (dp.status = 'in_lucru' AND dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())))
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM drill_points dp
      WHERE dp.id = lithology_intervals.drill_point_id
      AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR (dp.status = 'de_facut' OR (dp.status = 'in_lucru' AND dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())))
      )
    )
  );
