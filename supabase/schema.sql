-- Harta Teren - Drill Points Management
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'team')),
  team_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drill points
CREATE TABLE IF NOT EXISTS drill_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'de_facut' CHECK (status IN ('de_facut', 'in_lucru', 'finalizat')),
  assigned_team TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster status/team queries
CREATE INDEX IF NOT EXISTS idx_drill_points_status ON drill_points(status);
CREATE INDEX IF NOT EXISTS idx_drill_points_assigned_team ON drill_points(assigned_team);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drill_points ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read their own
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Profiles: allow insert on signup (via trigger)
CREATE POLICY "users_insert_own_profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Drill points: admin sees all
CREATE POLICY "admin_read_all_points" ON drill_points
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Drill points: teams see non-finalized OR their own assigned
CREATE POLICY "teams_read_points" ON drill_points
  FOR SELECT USING (
    status != 'finalizat'
    OR assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid())
  );

-- Drill points: admin can insert
CREATE POLICY "admin_insert_points" ON drill_points
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Drill points: admin can update all
CREATE POLICY "admin_update_all_points" ON drill_points
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Drill points: teams can update only de_facut (to claim) or their own in_lucru (to complete)
CREATE POLICY "teams_update_points" ON drill_points
  FOR UPDATE USING (
    status = 'de_facut'
    OR (status = 'in_lucru' AND assigned_team = (SELECT team_name FROM profiles WHERE id = auth.uid()))
  );

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, team_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'team'),
    NEW.raw_user_meta_data->>'team_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
