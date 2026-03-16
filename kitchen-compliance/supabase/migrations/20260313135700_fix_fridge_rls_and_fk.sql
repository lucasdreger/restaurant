-- Fix RLS policy for fridge temp logs by ensuring it works with the correct table and allows proper insertion for staff members
-- Date: 2026-03-XX

-- Drop existing policies that might be causing RLS conflicts
DROP POLICY IF EXISTS "fridge_temp_logs_insert" ON fridge_temp_logs;
DROP POLICY IF EXISTS "fridge_temp_logs_select" ON fridge_temp_logs;
DROP POLICY IF EXISTS "fridge_temp_logs_update" ON fridge_temp_logs;
DROP POLICY IF EXISTS "fridge_temp_logs_delete" ON fridge_temp_logs;
DROP POLICY IF EXISTS "Fridge temp logs delete" ON fridge_temp_logs;
DROP POLICY IF EXISTS "Demo user access" ON fridge_temp_logs;

-- Recreate policy with simplified, direct checks 
-- We allow insertion if the user is authenticated and the venue is associated with them.
CREATE POLICY "fridge_temp_logs_insert" ON fridge_temp_logs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (
      site_id IN (SELECT venue_id FROM venue_members WHERE user_id = auth.uid())
      OR site_id IN (SELECT id FROM venues WHERE created_by = auth.uid())
      OR (auth.uid() = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
      -- Allow staff members to insert logs directly if they are the recorded_by?
      -- BUT recorded_by here is a UUID of the staff_members table!
      -- Wait, if it's an authenticated user making the request, auth.uid() is the logged-in user.
      -- The app is typical B2B where the kitchen manager is logged in.
    )
  );

CREATE POLICY "fridge_temp_logs_select" ON fridge_temp_logs
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      site_id IN (SELECT venue_id FROM venue_members WHERE user_id = auth.uid())
      OR site_id IN (SELECT id FROM venues WHERE created_by = auth.uid())
      OR (auth.uid() = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
    )
  );

CREATE POLICY "fridge_temp_logs_update" ON fridge_temp_logs
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND (
      site_id IN (SELECT venue_id FROM venue_members WHERE user_id = auth.uid())
      OR site_id IN (SELECT id FROM venues WHERE created_by = auth.uid())
      OR (auth.uid() = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
    )
  );

CREATE POLICY "fridge_temp_logs_delete" ON fridge_temp_logs
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND (
      site_id IN (SELECT venue_id FROM venue_members WHERE user_id = auth.uid())
      OR site_id IN (SELECT id FROM venues WHERE created_by = auth.uid())
      OR (auth.uid() = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
    )
  );

-- Fix foreign key recorded_by
-- Drop any existing fk on recorded_by safely without assuming the target table exists
DO $$
DECLARE
    rec record;
    fk_found boolean := false;
BEGIN
    FOR rec IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'fridge_temp_logs'::regclass
        AND contype = 'f'
        AND (
            -- Look for constraint names typically generated
            conname LIKE '%recorded_by_fkey%'
            OR conname LIKE '%staff%'
            OR conname LIKE 'fk_fridge_temp_logs_recorded_by%'
            -- Or find by column: recorded_by
            OR conkey[1] = (SELECT attnum FROM pg_attribute WHERE attrelid = 'fridge_temp_logs'::regclass AND attname = 'recorded_by')
        )
    LOOP
        EXECUTE 'ALTER TABLE fridge_temp_logs DROP CONSTRAINT IF EXISTS ' || quote_ident(rec.conname);
    END LOOP;

    -- Add the correct constraint pointing to staff_members
    EXECUTE 'ALTER TABLE fridge_temp_logs ADD CONSTRAINT fk_fridge_temp_logs_recorded_by_staff_members FOREIGN KEY (recorded_by) REFERENCES staff_members(id) ON DELETE SET NULL';
END $$;
