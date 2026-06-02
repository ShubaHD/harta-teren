-- Câmpuri suplimentare pentru foraje (din Fișa Foraj Flutter)
-- kilometraj, tip_instalatie, intocmit, categorie_foraj

ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS kilometraj TEXT;
ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS tip_instalatie TEXT;
ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS intocmit TEXT;
ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS categorie_foraj TEXT;

-- Câmpuri suplimentare pentru proiecte
ALTER TABLE projects ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;
