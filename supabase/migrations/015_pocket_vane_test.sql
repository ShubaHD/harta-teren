-- Pocket Vane Test: interval adâncime, valoare citită (kg/cm²), diametru vane
CREATE TABLE IF NOT EXISTS pocket_vane_test (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drill_point_id UUID NOT NULL REFERENCES drill_points(id) ON DELETE CASCADE,
  from_m NUMERIC NOT NULL,
  to_m NUMERIC NOT NULL,
  value_kg_cm2 NUMERIC NOT NULL,
  vane_diameter TEXT NOT NULL,
  test_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pocket_vane_test_drill_point ON pocket_vane_test(drill_point_id);

ALTER TABLE pocket_vane_test ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_pocket_vane_test" ON pocket_vane_test FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drill_points dp
      WHERE dp.id = pocket_vane_test.drill_point_id
      AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR (dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid()))
      )
    )
  );

CREATE POLICY "auth_manage_pocket_vane_test" ON pocket_vane_test FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM drill_points dp
      WHERE dp.id = pocket_vane_test.drill_point_id
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
      WHERE dp.id = pocket_vane_test.drill_point_id
      AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat'
        OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())
      )
    )
  );
