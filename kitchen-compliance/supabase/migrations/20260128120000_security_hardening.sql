-- Security + Performance Hardening
-- Fix permissive RLS, add missing indexes, remove duplicates, lock search_path

-- Constants
-- Demo user id: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
-- Demo site/venue id: b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12

-- =========================
-- Indexes
-- =========================
CREATE INDEX IF NOT EXISTS idx_compliance_logs_user_id ON compliance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_reviewed_by ON compliance_reports(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_received_by_staff_id ON goods_receipts(received_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_temperature_logs_cooling_session_id ON temperature_logs(cooling_session_id);
CREATE INDEX IF NOT EXISTS idx_temperature_logs_recorded_by ON temperature_logs(recorded_by);

DROP INDEX IF EXISTS idx_profiles_current_venue_id;

-- =========================
-- Functions search_path hardening
-- =========================
CREATE OR REPLACE FUNCTION public.update_goods_receipt_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================
-- RLS Policies (tighten)
-- =========================
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooling_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooling_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fridge_temp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fridges ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE temperature_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

-- Alerts (via cooling_sessions -> site_id)
DROP POLICY IF EXISTS "Allow public read" ON alerts;
DROP POLICY IF EXISTS "Allow public insert" ON alerts;
DROP POLICY IF EXISTS "Allow public update" ON alerts;

CREATE POLICY "alerts_select" ON alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM cooling_sessions cs
      WHERE cs.id = alerts.session_id
        AND (
          cs.site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
          OR cs.site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
          OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND cs.site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
        )
    )
  );

CREATE POLICY "alerts_insert" ON alerts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM cooling_sessions cs
      WHERE cs.id = alerts.session_id
        AND (
          cs.site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
          OR cs.site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
          OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND cs.site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
        )
    )
  );

CREATE POLICY "alerts_update" ON alerts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM cooling_sessions cs
      WHERE cs.id = alerts.session_id
        AND (
          cs.site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
          OR cs.site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
          OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND cs.site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
        )
    )
  );

-- Compliance logs
DROP POLICY IF EXISTS "Allow public read compliance" ON compliance_logs;
DROP POLICY IF EXISTS "Allow public insert compliance" ON compliance_logs;
DROP POLICY IF EXISTS "Allow public update compliance" ON compliance_logs;
DROP POLICY IF EXISTS "Demo user access" ON compliance_logs;
DROP POLICY IF EXISTS "Enable read/write for authenticated users based on site" ON compliance_logs;

CREATE POLICY "compliance_logs_select" ON compliance_logs
  FOR SELECT USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "compliance_logs_insert" ON compliance_logs
  FOR INSERT WITH CHECK (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "compliance_logs_update" ON compliance_logs
  FOR UPDATE USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

-- Compliance reports
DROP POLICY IF EXISTS "Allow all for authenticated" ON compliance_reports;

CREATE POLICY "compliance_reports_select" ON compliance_reports
  FOR SELECT USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "compliance_reports_insert" ON compliance_reports
  FOR INSERT WITH CHECK (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "compliance_reports_update" ON compliance_reports
  FOR UPDATE USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

-- Cooling sessions/events
DROP POLICY IF EXISTS "Cooling sessions select" ON cooling_sessions;
DROP POLICY IF EXISTS "Cooling sessions insert" ON cooling_sessions;
DROP POLICY IF EXISTS "Cooling sessions update" ON cooling_sessions;
DROP POLICY IF EXISTS "Demo user access" ON cooling_sessions;

CREATE POLICY "cooling_sessions_select" ON cooling_sessions
  FOR SELECT USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "cooling_sessions_insert" ON cooling_sessions
  FOR INSERT WITH CHECK (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "cooling_sessions_update" ON cooling_sessions
  FOR UPDATE USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

DROP POLICY IF EXISTS "Cooling events select" ON cooling_events;
DROP POLICY IF EXISTS "Cooling events insert" ON cooling_events;

CREATE POLICY "cooling_events_select" ON cooling_events
  FOR SELECT USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "cooling_events_insert" ON cooling_events
  FOR INSERT WITH CHECK (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

-- Delivery images (via goods_receipts)
DROP POLICY IF EXISTS "Allow all operations on delivery_images" ON delivery_images;
DROP POLICY IF EXISTS "Demo user access" ON delivery_images;

CREATE POLICY "delivery_images_select" ON delivery_images
  FOR SELECT USING (
    receipt_id IN (
      SELECT gr.id
      FROM goods_receipts gr
      WHERE gr.site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
         OR gr.site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
         OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND gr.site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
    )
  );

CREATE POLICY "delivery_images_insert" ON delivery_images
  FOR INSERT WITH CHECK (
    receipt_id IN (
      SELECT gr.id
      FROM goods_receipts gr
      WHERE gr.site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
         OR gr.site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
         OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND gr.site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
    )
  );

CREATE POLICY "delivery_images_update" ON delivery_images
  FOR UPDATE USING (
    receipt_id IN (
      SELECT gr.id
      FROM goods_receipts gr
      WHERE gr.site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
         OR gr.site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
         OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND gr.site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
    )
  );

-- Food items
DROP POLICY IF EXISTS "Allow all for authenticated" ON food_items;
DROP POLICY IF EXISTS "Allow public read food" ON food_items;
DROP POLICY IF EXISTS "Allow public insert food" ON food_items;
DROP POLICY IF EXISTS "Allow public update food" ON food_items;
DROP POLICY IF EXISTS "Allow public delete food" ON food_items;

CREATE POLICY "food_items_select" ON food_items
  FOR SELECT USING (
    site_id IS NULL
    OR site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "food_items_insert" ON food_items
  FOR INSERT WITH CHECK (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id IS NULL)
  );

CREATE POLICY "food_items_update" ON food_items
  FOR UPDATE USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id IS NULL)
  );

CREATE POLICY "food_items_delete" ON food_items
  FOR DELETE USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id IS NULL)
  );

-- Fridges
DROP POLICY IF EXISTS "fridges_read" ON fridges;
DROP POLICY IF EXISTS "fridges_write" ON fridges;
DROP POLICY IF EXISTS "Demo user access" ON fridges;

CREATE POLICY "fridges_select" ON fridges
  FOR SELECT USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "fridges_insert" ON fridges
  FOR INSERT WITH CHECK (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "fridges_update" ON fridges
  FOR UPDATE USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "fridges_delete" ON fridges
  FOR DELETE USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

-- Fridge temp logs
DROP POLICY IF EXISTS "fridge_temp_logs_read" ON fridge_temp_logs;
DROP POLICY IF EXISTS "fridge_temp_logs_write" ON fridge_temp_logs;
DROP POLICY IF EXISTS "Demo user access" ON fridge_temp_logs;

CREATE POLICY "fridge_temp_logs_select" ON fridge_temp_logs
  FOR SELECT USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "fridge_temp_logs_insert" ON fridge_temp_logs
  FOR INSERT WITH CHECK (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "fridge_temp_logs_update" ON fridge_temp_logs
  FOR UPDATE USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

-- Goods receipts
DROP POLICY IF EXISTS "Allow all operations on goods_receipts" ON goods_receipts;
DROP POLICY IF EXISTS "Demo user access" ON goods_receipts;

CREATE POLICY "goods_receipts_select" ON goods_receipts
  FOR SELECT USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "goods_receipts_insert" ON goods_receipts
  FOR INSERT WITH CHECK (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "goods_receipts_update" ON goods_receipts
  FOR UPDATE USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

-- Goods receipt items
DROP POLICY IF EXISTS "Allow all operations on goods_receipt_items" ON goods_receipt_items;
DROP POLICY IF EXISTS "Demo user access" ON goods_receipt_items;

CREATE POLICY "goods_receipt_items_select" ON goods_receipt_items
  FOR SELECT USING (
    receipt_id IN (
      SELECT gr.id
      FROM goods_receipts gr
      WHERE gr.site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
         OR gr.site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
         OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND gr.site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
    )
  );

CREATE POLICY "goods_receipt_items_insert" ON goods_receipt_items
  FOR INSERT WITH CHECK (
    receipt_id IN (
      SELECT gr.id
      FROM goods_receipts gr
      WHERE gr.site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
         OR gr.site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
         OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND gr.site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
    )
  );

CREATE POLICY "goods_receipt_items_update" ON goods_receipt_items
  FOR UPDATE USING (
    receipt_id IN (
      SELECT gr.id
      FROM goods_receipts gr
      WHERE gr.site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
         OR gr.site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
         OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND gr.site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
    )
  );

-- Site settings
DROP POLICY IF EXISTS "Allow all for authenticated" ON site_settings;

CREATE POLICY "site_settings_select" ON site_settings
  FOR SELECT USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "site_settings_insert" ON site_settings
  FOR INSERT WITH CHECK (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "site_settings_update" ON site_settings
  FOR UPDATE USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

-- Sites
DROP POLICY IF EXISTS "Allow public read" ON sites;
DROP POLICY IF EXISTS "Allow public insert" ON sites;
DROP POLICY IF EXISTS "Allow public update" ON sites;
DROP POLICY IF EXISTS "Demo user access" ON sites;

CREATE POLICY "sites_select" ON sites
  FOR SELECT USING (
    id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "sites_insert" ON sites
  FOR INSERT WITH CHECK (
    id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "sites_update" ON sites
  FOR UPDATE USING (
    id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

-- Staff members
DROP POLICY IF EXISTS "Allow all for authenticated" ON staff_members;
DROP POLICY IF EXISTS "Allow public read staff" ON staff_members;
DROP POLICY IF EXISTS "Allow public insert staff" ON staff_members;
DROP POLICY IF EXISTS "Allow public update staff" ON staff_members;
DROP POLICY IF EXISTS "Allow public delete staff" ON staff_members;
DROP POLICY IF EXISTS "Demo user access" ON staff_members;

CREATE POLICY "staff_members_select" ON staff_members
  FOR SELECT USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "staff_members_insert" ON staff_members
  FOR INSERT WITH CHECK (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "staff_members_update" ON staff_members
  FOR UPDATE USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "staff_members_delete" ON staff_members
  FOR DELETE USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

-- Temperature logs
DROP POLICY IF EXISTS "Allow all for authenticated" ON temperature_logs;

CREATE POLICY "temperature_logs_select" ON temperature_logs
  FOR SELECT USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "temperature_logs_insert" ON temperature_logs
  FOR INSERT WITH CHECK (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "temperature_logs_update" ON temperature_logs
  FOR UPDATE USING (
    site_id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR site_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

-- Venue members
DROP POLICY IF EXISTS "Users can view their venue memberships" ON venue_members;
DROP POLICY IF EXISTS "Users can view their memberships" ON venue_members;
DROP POLICY IF EXISTS "Users can create memberships" ON venue_members;
DROP POLICY IF EXISTS "Venue owners can manage members" ON venue_members;

CREATE POLICY "venue_members_select" ON venue_members
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
    OR venue_id IN (
      SELECT venue_id
      FROM venue_members vm
      WHERE vm.user_id = (SELECT auth.uid()) AND vm.role = 'owner'
    )
    OR venue_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
  );

CREATE POLICY "venue_members_insert" ON venue_members
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (
      venue_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
      OR user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "venue_members_update" ON venue_members
  FOR UPDATE USING (
    venue_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR venue_id IN (
      SELECT venue_id
      FROM venue_members vm
      WHERE vm.user_id = (SELECT auth.uid()) AND vm.role = 'owner'
    )
  );

CREATE POLICY "venue_members_delete" ON venue_members
  FOR DELETE USING (
    venue_id IN (SELECT id FROM venues WHERE created_by = (SELECT auth.uid()))
    OR venue_id IN (
      SELECT venue_id
      FROM venue_members vm
      WHERE vm.user_id = (SELECT auth.uid()) AND vm.role = 'owner'
    )
  );

-- Venues
DROP POLICY IF EXISTS "Users can view their venues" ON venues;
DROP POLICY IF EXISTS "Users can create venues" ON venues;
DROP POLICY IF EXISTS "Owners can update venues" ON venues;
DROP POLICY IF EXISTS "Demo user access" ON venues;

CREATE POLICY "venues_select" ON venues
  FOR SELECT USING (
    created_by = (SELECT auth.uid())
    OR id IN (SELECT venue_id FROM venue_members WHERE user_id = (SELECT auth.uid()))
    OR ((SELECT auth.uid()) = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid AND id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid)
  );

CREATE POLICY "venues_insert" ON venues
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND created_by = (SELECT auth.uid())
  );

CREATE POLICY "venues_update" ON venues
  FOR UPDATE USING (
    created_by = (SELECT auth.uid())
    OR id IN (
      SELECT venue_id
      FROM venue_members vm
      WHERE vm.user_id = (SELECT auth.uid()) AND vm.role = 'owner'
    )
  );

CREATE POLICY "venues_delete" ON venues
  FOR DELETE USING (
    created_by = (SELECT auth.uid())
  );

-- Profiles (use initplan-friendly auth.uid())
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);

