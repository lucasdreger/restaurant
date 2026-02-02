-- Demo User Setup Migration
-- Creates persistent demo user with venue and seed data

-- 1. Create demo user in auth.users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'demo@chefvoice.app') THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_sent_at,
      created_at,
      updated_at,
      raw_user_meta_data,
      is_super_admin,
      raw_app_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      'authenticated',
      'authenticated',
      'demo@chefvoice.app',
      crypt('demo123!@#', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      NOW(),
      '{"full_name": "Demo User"}'::jsonb,
      false,
      '{"provider": "email", "providers": ["email"]}'::jsonb
    );
  END IF;
END $$;

-- 2. Create demo venue
INSERT INTO venues (id, name, address, created_by, subscription_tier)
VALUES (
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
  'Demo Kitchen Restaurant',
  '123 Demo Street, Dublin 2, Ireland',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'pro'
) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 3. Create demo profile
INSERT INTO profiles (id, email, full_name, onboarding_completed, current_venue_id)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'demo@chefvoice.app',
  'Demo User',
  true,
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'
) ON CONFLICT (id) DO UPDATE SET current_venue_id = EXCLUDED.current_venue_id;

-- 4. Create demo staff
INSERT INTO staff_members (id, site_id, name, initials, role, active) VALUES
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'John Chef', 'JC', 'chef', true),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Mary Manager', 'MM', 'manager', true),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Sam Staff', 'SS', 'staff', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Update RLS policies for demo user access
DROP POLICY IF EXISTS "Demo user access" ON venues;
CREATE POLICY "Demo user access" ON venues
  FOR ALL USING (created_by = auth.uid() OR auth.uid() = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

DROP POLICY IF EXISTS "Demo user access" ON staff_members;
CREATE POLICY "Demo user access" ON staff_members
  FOR ALL USING (site_id IN (SELECT id FROM sites WHERE created_by = auth.uid()) OR auth.uid() = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

DROP POLICY IF EXISTS "Demo user access" ON compliance_records;
CREATE POLICY "Demo user access" ON compliance_records
  FOR ALL USING (site_id IN (SELECT id FROM sites WHERE created_by = auth.uid()) OR auth.uid() = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

DROP POLICY IF EXISTS "Demo user access" ON cooling_logs;
CREATE POLICY "Demo user access" ON cooling_logs
  FOR ALL USING (site_id IN (SELECT id FROM sites WHERE created_by = auth.uid()) OR auth.uid() = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

DROP POLICY IF EXISTS "Demo user access" ON goods_receipts;
CREATE POLICY "Demo user access" ON goods_receipts
  FOR ALL USING (site_id IN (SELECT id FROM sites WHERE created_by = auth.uid()) OR auth.uid() = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

DROP POLICY IF EXISTS "Demo user access" ON goods_receipt_items;
CREATE POLICY "Demo user access" ON goods_receipt_items
  FOR ALL USING (receipt_id IN (SELECT id FROM goods_receipts WHERE site_id IN (SELECT id FROM sites WHERE created_by = auth.uid()) OR auth.uid() = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'));

DROP POLICY IF EXISTS "Demo user access" ON delivery_images;
CREATE POLICY "Demo user access" ON delivery_images
  FOR ALL USING (site_id IN (SELECT id FROM sites WHERE created_by = auth.uid()) OR auth.uid() = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
