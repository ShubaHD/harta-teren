-- Acces pe proiect pentru conturi de echipă (ex. FCC vede doar unele proiecte).
-- Fără rânduri în project_access = vede toate proiectele (comportamentul actual).
-- Cu rânduri = vede doar proiectele bifate.
-- Poți rula de mai multe ori (idempotent).

CREATE TABLE IF NOT EXISTS project_access (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_access_project ON project_access(project_id);

ALTER TABLE project_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_project_access" ON project_access;
CREATE POLICY "users_read_own_project_access"
  ON project_access FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_all_project_access" ON project_access;
CREATE POLICY "admin_all_project_access"
  ON project_access FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE OR REPLACE FUNCTION public.can_access_project(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR NOT EXISTS (SELECT 1 FROM project_access WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM project_access
      WHERE user_id = auth.uid() AND project_id = p_id
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid) TO authenticated;

DROP POLICY IF EXISTS "teams_read_projects" ON projects;
CREATE POLICY "teams_read_projects" ON projects FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'team')
    AND public.can_access_project(id)
  );

DROP POLICY IF EXISTS "teams_read_points" ON drill_points;
CREATE POLICY "teams_read_points" ON drill_points
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'team')
    AND public.can_access_project(project_id)
  );

DROP POLICY IF EXISTS "teams_update_points" ON drill_points;
CREATE POLICY "teams_update_points" ON drill_points
  FOR UPDATE TO authenticated
  USING (
    public.can_access_project(project_id)
    AND (
      status = 'de_facut'
      OR (
        status IN ('in_lucru', 'finalizat')
        AND (
          LOWER(TRIM(COALESCE(assigned_team, ''))) = LOWER(TRIM(COALESCE((SELECT team_name FROM profiles WHERE id = auth.uid()), '')))
          OR TRIM(COALESCE(assigned_team, '')) = ''
        )
      )
    )
  )
  WITH CHECK (true);
