-- Câmpuri CSV: Echipare1, Echipare2, Prioritate (1/2/3). z se salvează în elevation_h.
ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS echipare1 TEXT;
ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS echipare2 TEXT;
ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS prioritate TEXT;
