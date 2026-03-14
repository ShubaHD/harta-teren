-- Adaugă coloana adâncime finală (introdusă de echipă la finalizare)

ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS final_depth TEXT;
