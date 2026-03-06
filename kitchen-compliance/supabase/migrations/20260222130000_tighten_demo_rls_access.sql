-- Tighten demo-site read access.
-- Previous migration allowed all authenticated users to read demo-site data.
-- This migration restricts demo-site reads to the explicit demo user only.

-- Constants
-- Demo user id: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
-- Demo site/venue id: b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12

-- 1) staff_members
DROP POLICY IF EXISTS "staff_members_select" ON staff_members;
CREATE POLICY "staff_members_select" ON staff_members
  FOR SELECT USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR (
      (SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid
      AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid
    )
  );

-- 2) cooling_sessions
DROP POLICY IF EXISTS "cooling_sessions_select" ON cooling_sessions;
CREATE POLICY "cooling_sessions_select" ON cooling_sessions
  FOR SELECT USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR (
      (SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid
      AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid
    )
  );

-- 3) food_items
DROP POLICY IF EXISTS "food_items_select" ON food_items;
CREATE POLICY "food_items_select" ON food_items
  FOR SELECT USING (
    site_id IS NULL
    OR site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR (
      (SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid
      AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid
    )
  );

-- 4) fridges
DROP POLICY IF EXISTS "fridges_select" ON fridges;
CREATE POLICY "fridges_select" ON fridges
  FOR SELECT USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR (
      (SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid
      AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid
    )
  );

-- 5) site_settings
DROP POLICY IF EXISTS "site_settings_select" ON site_settings;
CREATE POLICY "site_settings_select" ON site_settings
  FOR SELECT USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR (
      (SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid
      AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid
    )
  );
