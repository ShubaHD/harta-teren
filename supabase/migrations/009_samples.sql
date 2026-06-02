-- Probe: adâncime, tip (Tulburată, SPT etc.), valori SPT, observații
CREATE TABLE IF NOT EXISTS samples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drill_point_id UUID NOT NULL REFERENCES drill_points(id) ON DELETE CASCADE,
  depth_m NUMERIC NOT NULL,
  type TEXT NOT NULL,
  spt_values TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_samples_drill_point ON samples(drill_point_id);

ALTER TABLE samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_samples" ON samples FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drill_points dp
      WHERE dp.id = samples.drill_point_id
      AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR (dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid()))
      )
    )
  );

CREATE POLICY "auth_manage_samples" ON samples FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM drill_points dp
      WHERE dp.id = samples.drill_point_id
      AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR (dp.status = 'de_facut' OR (dp.status = 'in_lucru' AND dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())))
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM drill_points dp
      WHERE dp.id = samples.drill_point_id
      AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR (dp.status = 'de_facut' OR (dp.status = 'in_lucru' AND dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())))
      )
    )
  );
