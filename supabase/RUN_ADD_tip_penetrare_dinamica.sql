-- Rulează acest script în Supabase Dashboard → SQL Editor dacă primești eroarea
-- "Could not find the 'tip_penetrare_dinamica' column of 'drill_points' in the schema cache"

-- Coloană pe drill_points
ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS tip_penetrare_dinamica TEXT
  CHECK (tip_penetrare_dinamica IS NULL OR tip_penetrare_dinamica IN ('DPSH', 'DPM', 'DPL', 'DPH'));

-- Tabel pentru intervale penetrare dinamică (dacă nu există)
CREATE TABLE IF NOT EXISTS dynamic_penetration_intervals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drill_point_id UUID NOT NULL REFERENCES drill_points(id) ON DELETE CASCADE,
  from_m NUMERIC(6,3) NOT NULL,
  to_m NUMERIC(6,3) NOT NULL,
  blows INT NOT NULL DEFAULT 0 CHECK (blows >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(drill_point_id, from_m, to_m)
);

CREATE INDEX IF NOT EXISTS idx_dynamic_penetration_drill_point ON dynamic_penetration_intervals(drill_point_id);

ALTER TABLE dynamic_penetration_intervals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_dynamic_penetration" ON dynamic_penetration_intervals;
CREATE POLICY "auth_read_dynamic_penetration" ON dynamic_penetration_intervals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drill_points dp
      WHERE dp.id = dynamic_penetration_intervals.drill_point_id
      AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR (dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "auth_manage_dynamic_penetration" ON dynamic_penetration_intervals;
CREATE POLICY "auth_manage_dynamic_penetration" ON dynamic_penetration_intervals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM drill_points dp
      WHERE dp.id = dynamic_penetration_intervals.drill_point_id
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
      WHERE dp.id = dynamic_penetration_intervals.drill_point_id
      AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat'
        OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())
      )
    )
  );
