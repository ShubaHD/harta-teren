-- Admin poate citi toate profilurile (pentru lista echipe)

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "admin_read_all_profiles" ON profiles
  FOR SELECT USING (public.is_admin());
