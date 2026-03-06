-- Fix Security Definer View on public.venues and resolve recursion
-- The venues view was security definer, which is unsafe.
-- Making it security invoker causes recursion between sites and venue_members policies.
-- Solution: Use a security definer function to check site ownership safely.

-- 1. Create helper function to check site ownership without recursion
CREATE OR REPLACE FUNCTION public.is_site_creator(p_site_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if current user is the creator of the site
  -- Also includes the hardcoded demo user logic
  RETURN EXISTS (
    SELECT 1
    FROM sites
    WHERE id = p_site_id
      AND (
        created_by = (SELECT auth.uid())
        OR (
            (SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid 
            AND id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid -- Note: In previous migrations this was sometimes referenced as b0eebc99...12 but site id is a0ee...11 in initial schema? 
            -- Checking initial schema: 
            -- INSERT INTO sites (id...) VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'...)
            -- But in security hardening it says: 
            -- Demo site/venue id: b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12
            -- Let's check the actual site value from previous policies to be safe.
            -- "AND id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid"
            -- We will trust the security hardening migration values.
        )
      )
  );
END;
$$;

-- Note on Demo IDs from security_hardening.sql check:
-- ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
-- So we use b0eebc99...12 for the site ID check.

CREATE OR REPLACE FUNCTION public.is_site_creator(p_site_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM sites
    WHERE id = p_site_id
      AND (
        created_by = (SELECT auth.uid())
        OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
      )
  );
END;
$$;

-- 2. Update sites policies to not depend on venues view
DROP POLICY IF EXISTS "sites_select" ON sites;
DROP POLICY IF EXISTS "sites_insert" ON sites;
DROP POLICY IF EXISTS "sites_update" ON sites;
DROP POLICY IF EXISTS "sites_delete" ON sites;

CREATE POLICY "sites_select" ON sites
  FOR SELECT USING (
    created_by = (SELECT auth.uid())
    OR id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "sites_insert" ON sites
  FOR INSERT WITH CHECK (
    created_by = (SELECT auth.uid())
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "sites_update" ON sites
  FOR UPDATE USING (
    created_by = (SELECT auth.uid())
    OR public.is_site_creator(id) -- Allow creator (owner) to update. Using function is safe here too, though created_by check is enough.
    -- Wait, sites_update was:
    -- id IN (SELECT id FROM venues WHERE created_by = ...)
    -- which basically means created_by = auth.uid()
    -- So we can just simplify.
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

-- 3. Update venue_members policies to use is_site_creator instead of querying venues (which queries sites)
DROP POLICY IF EXISTS "venue_members_select" ON venue_members;
DROP POLICY IF EXISTS "venue_members_insert" ON venue_members;
DROP POLICY IF EXISTS "venue_members_update" ON venue_members;
DROP POLICY IF EXISTS "venue_members_delete" ON venue_members;

CREATE POLICY "venue_members_select" ON venue_members
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
    OR venue_id IN (
      SELECT venue_id
      FROM venue_members vm
      WHERE vm.user_id = (SELECT auth.uid()) AND vm.role = 'owner'
    )
    OR public.is_site_creator(venue_id)
  );

CREATE POLICY "venue_members_insert" ON venue_members
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (
      public.is_site_creator(venue_id)
      OR user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "venue_members_update" ON venue_members
  FOR UPDATE USING (
    public.is_site_creator(venue_id)
    OR venue_id IN (
      SELECT venue_id
      FROM venue_members vm
      WHERE vm.user_id = (SELECT auth.uid()) AND vm.role = 'owner'
    )
  );

CREATE POLICY "venue_members_delete" ON venue_members
  FOR DELETE USING (
    public.is_site_creator(venue_id)
    OR venue_id IN (
      SELECT venue_id
      FROM venue_members vm
      WHERE vm.user_id = (SELECT auth.uid()) AND vm.role = 'owner'
    )
  );

-- 4. Update venues view to be security invoker
ALTER VIEW public.venues SET (security_invoker = true);

-- Drop policies on the view itself as they are mistakenly applied/unused when security_invoker is true or were part of the confusion
DROP POLICY IF EXISTS "venues_select" ON venues;
DROP POLICY IF EXISTS "venues_insert" ON venues;
DROP POLICY IF EXISTS "venues_update" ON venues;
DROP POLICY IF EXISTS "venues_delete" ON venues;

