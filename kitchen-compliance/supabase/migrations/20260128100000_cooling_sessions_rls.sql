-- Cooling Sessions RLS + Sites Backfill

-- 1. Backfill sites from venues (ensures FK target exists)
INSERT INTO sites (id, name, address, created_at, updated_at)
SELECT v.id,
       v.name,
       v.address,
       NOW(),
       NOW()
FROM venues v
WHERE NOT EXISTS (
  SELECT 1 FROM sites s WHERE s.id = v.id
);

-- 2. Tighten RLS policies for cooling_sessions (remove public access)
DROP POLICY IF EXISTS "Allow public read" ON cooling_sessions;
DROP POLICY IF EXISTS "Allow public insert" ON cooling_sessions;
DROP POLICY IF EXISTS "Allow public update" ON cooling_sessions;

CREATE POLICY "Cooling sessions select" ON cooling_sessions
  FOR SELECT USING (
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

CREATE POLICY "Cooling sessions insert" ON cooling_sessions
  FOR INSERT WITH CHECK (
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

CREATE POLICY "Cooling sessions update" ON cooling_sessions
  FOR UPDATE USING (
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

-- 3. Tighten RLS policies for cooling_events (remove public access)
DROP POLICY IF EXISTS "Allow public read" ON cooling_events;
DROP POLICY IF EXISTS "Allow public insert" ON cooling_events;

CREATE POLICY "Cooling events select" ON cooling_events
  FOR SELECT USING (
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

CREATE POLICY "Cooling events insert" ON cooling_events
  FOR INSERT WITH CHECK (
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
