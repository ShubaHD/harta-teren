-- Rulează acest fișier în Supabase SQL Editor dacă Litologie și Probe nu funcționează.
-- Creează tabelele lithology_intervals și samples.

-- ========== LITOLOGIE ==========
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

DROP POLICY IF EXISTS "auth_read_lithology" ON lithology_intervals;
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

-- ========== PROBE ==========
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

DROP POLICY IF EXISTS "auth_read_samples" ON samples;
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

DROP POLICY IF EXISTS "auth_manage_samples" ON samples;
CREATE POLICY "auth_manage_samples" ON samples FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM drill_points dp
      WHERE dp.id = samples.drill_point_id
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
      WHERE dp.id = samples.drill_point_id
      AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        OR dp.status != 'finalizat'
        OR dp.assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())
      )
    )
  );
