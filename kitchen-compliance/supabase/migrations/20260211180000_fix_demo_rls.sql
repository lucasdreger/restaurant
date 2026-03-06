-- Allow all authenticated users to access the demo site data
-- This is necessary so that new users (who fall back to the demo site) can actually see the data.

-- Constants
-- Demo site/venue id: b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12

-- 1. Staff Members
DROP POLICY IF EXISTS "staff_members_select" ON staff_members;
CREATE POLICY "staff_members_select" ON staff_members
  FOR SELECT USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid
  );

-- 2. Cooling Sessions
DROP POLICY IF EXISTS "cooling_sessions_select" ON cooling_sessions;
CREATE POLICY "cooling_sessions_select" ON cooling_sessions
  FOR SELECT USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid
  );

-- 3. Food Items
DROP POLICY IF EXISTS "food_items_select" ON food_items;
CREATE POLICY "food_items_select" ON food_items
  FOR SELECT USING (
    site_id IS NULL
    OR site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid
  );

-- 4. Fridges
DROP POLICY IF EXISTS "fridges_select" ON fridges;
CREATE POLICY "fridges_select" ON fridges
  FOR SELECT USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid
  );

-- 5. Site Settings
DROP POLICY IF EXISTS "site_settings_select" ON site_settings;
CREATE POLICY "site_settings_select" ON site_settings
  FOR SELECT USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid
  );
