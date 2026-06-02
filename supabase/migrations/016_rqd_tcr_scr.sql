-- RQD, TCR, SCR: interval adâncime, carote >10cm, recuperare totală
CREATE TABLE IF NOT EXISTS rqd_tcr_scr (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drill_point_id UUID NOT NULL REFERENCES drill_points(id) ON DELETE CASCADE,
  from_m NUMERIC NOT NULL,
  to_m NUMERIC NOT NULL,
  carota_gt_10cm TEXT NOT NULL,
  total_recovered_cm NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rqd_tcr_scr_drill_point ON rqd_tcr_scr(drill_point_id);

ALTER TABLE rqd_tcr_scr ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_rqd_tcr_scr" ON rqd_tcr_scr FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drill_points dp
      WHERE dp.id = rqd_tcr_scr.drill_point_id
      AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR (dp.status != 'finalizat' OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid()))
      )
    )
  );

CREATE POLICY "auth_manage_rqd_tcr_scr" ON rqd_tcr_scr FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM drill_points dp
      WHERE dp.id = rqd_tcr_scr.drill_point_id
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
      WHERE dp.id = rqd_tcr_scr.drill_point_id
      AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat'
        OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())
      )
    )
  );
