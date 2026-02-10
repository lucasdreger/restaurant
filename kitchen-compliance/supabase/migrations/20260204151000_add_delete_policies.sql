-- Migration to add missing DELETE policies for session persistence
-- Created on 2026-02-04

-- 1. Cooling Sessions DELETE policy
DROP POLICY IF EXISTS "Cooling sessions delete" ON cooling_sessions;
CREATE POLICY "Cooling sessions delete" ON cooling_sessions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM venue_members vm
      WHERE vm.venue_id = cooling_sessions.site_id
        AND vm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM venues v
      WHERE v.id = cooling_sessions.site_id
        AND v.created_by = auth.uid()
    )
    OR auth.uid() = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  );

-- 2. Cooling Events DELETE policy
DROP POLICY IF EXISTS "Cooling events delete" ON cooling_events;
CREATE POLICY "Cooling events delete" ON cooling_events
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM venue_members vm
      WHERE vm.venue_id = cooling_events.site_id
        AND vm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM venues v
      WHERE v.id = cooling_events.site_id
        AND v.created_by = auth.uid()
    )
    OR auth.uid() = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  );

-- 3. Fridge Temp Logs DELETE policy
DROP POLICY IF EXISTS "Fridge temp logs delete" ON fridge_temp_logs;
CREATE POLICY "Fridge temp logs delete" ON fridge_temp_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM venue_members vm
      WHERE vm.venue_id = fridge_temp_logs.site_id
        AND vm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM venues v
      WHERE v.id = fridge_temp_logs.site_id
        AND v.created_by = auth.uid()
    )
    OR auth.uid() = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  );

-- 4. Compliance Logs DELETE policy
DROP POLICY IF EXISTS "Compliance logs delete" ON compliance_logs;
CREATE POLICY "Compliance logs delete" ON compliance_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM venue_members vm
      WHERE vm.venue_id = compliance_logs.site_id
        AND vm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM venues v
      WHERE v.id = compliance_logs.site_id
        AND v.created_by = auth.uid()
    )
    OR auth.uid() = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  );
