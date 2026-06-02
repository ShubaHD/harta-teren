-- Nivel apă: adăugare la drill_points (mutat din litologie)
ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS water_during TEXT;
ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS water_after_24h TEXT;
