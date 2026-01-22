-- Add onboarding and venue detail fields

-- Update venues table with additional fields for onboarding
ALTER TABLE venues
ADD COLUMN IF NOT EXISTS venue_type TEXT DEFAULT 'restaurant',
ADD COLUMN IF NOT EXISTS seating_capacity INTEGER,
ADD COLUMN IF NOT EXISTS avg_daily_covers INTEGER,
ADD COLUMN IF NOT EXISTS number_of_staff INTEGER,
ADD COLUMN IF NOT EXISTS has_kitchen_manager BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS compliance_method TEXT,
ADD COLUMN IF NOT EXISTS main_pain_point TEXT,
ADD COLUMN IF NOT EXISTS opening_date DATE,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Create profiles table for user onboarding status
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'staff',
  current_venue_id UUID REFERENCES venues(id),
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create venue_members table to link users to venues
CREATE TABLE IF NOT EXISTS venue_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'staff',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(venue_id, user_id)
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_members ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Venue members policies
CREATE POLICY "Users can view their venue memberships"
  ON venue_members FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Venue owners can manage members"
  ON venue_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM venue_members vm
      WHERE vm.venue_id = venue_members.venue_id
      AND vm.user_id = auth.uid()
      AND vm.role = 'owner'
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_current_venue ON profiles(current_venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_members_venue ON venue_members(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_members_user ON venue_members(user_id);
CREATE INDEX IF NOT EXISTS idx_venues_created_by ON venues(created_by);
