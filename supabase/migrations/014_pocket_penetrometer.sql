-- Pocket Penetrometru: De la (m), Până la (m), Plunger, Valori (kg/cm²)
CREATE TABLE IF NOT EXISTS pocket_penetrometer (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drill_point_id UUID NOT NULL REFERENCES drill_points(id) ON DELETE CASCADE,
  from_m NUMERIC NOT NULL,
  to_m NUMERIC NOT NULL,
  plunger TEXT NOT NULL,
  valori TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pocket_penetrometer_drill_point ON pocket_penetrometer(drill_point_id);

ALTER TABLE pocket_penetrometer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_pocket_penetrometer" ON pocket_penetrometer FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drill_points dp
      WHERE dp.id = pocket_penetrometer.drill_point_id
      AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR (dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid()))
      )
    )
  );

CREATE POLICY "auth_manage_pocket_penetrometer" ON pocket_penetrometer FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM drill_points dp
      WHERE dp.id = pocket_penetrometer.drill_point_id
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
      WHERE dp.id = pocket_penetrometer.drill_point_id
      AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat'
        OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())
      )
    )
  );
