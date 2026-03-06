-- Fix Permissive RLS Policies
-- Removes "Allow public ..." policies that were overly permissive (using TRUE).
-- Tightens policies for app_interactions and user_feedback to be authenticated only.

-- 1. App Interactions
-- Drop anonymous insert
DROP POLICY IF EXISTS "Allow anon insert interactions" ON app_interactions;

-- Update authenticated insert to check user_id matches
DROP POLICY IF EXISTS "Allow authenticated insert interactions" ON app_interactions;
CREATE POLICY "Allow authenticated insert interactions" ON app_interactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 2. User Feedback
-- Drop anonymous insert
DROP POLICY IF EXISTS "Allow anonymous feedback insert" ON user_feedback;

-- Update authenticated insert to ensure user_id matches (existing policy "Users can insert their own feedback" covers this, just checking if we need to drop/recreate to be sure or just proceed)
-- Existing policy: "Users can insert their own feedback" WITH CHECK (auth.uid() = user_id)
-- If "Allow anonymous feedback insert" is dropped, we are good.

-- 3. Food Items
DROP POLICY IF EXISTS "Allow public delete food" ON food_items;
DROP POLICY IF EXISTS "Allow public insert food" ON food_items;
DROP POLICY IF EXISTS "Allow public update food" ON food_items;
DROP POLICY IF EXISTS "Allow public read food" ON food_items;

-- 4. Fridge Temp Logs
DROP POLICY IF EXISTS "fridge_temp_logs_write" ON fridge_temp_logs;
DROP POLICY IF EXISTS "fridge_temp_logs_read" ON fridge_temp_logs;

-- 5. Fridges
DROP POLICY IF EXISTS "fridges_write" ON fridges;
DROP POLICY IF EXISTS "fridges_read" ON fridges;

-- 6. Goods Receipt Items
DROP POLICY IF EXISTS "Allow public insert" ON goods_receipt_items;
DROP POLICY IF EXISTS "Allow public update" ON goods_receipt_items;
DROP POLICY IF EXISTS "Allow public read" ON goods_receipt_items;

-- 7. Goods Receipts
DROP POLICY IF EXISTS "Allow public insert" ON goods_receipts;
DROP POLICY IF EXISTS "Allow public update" ON goods_receipts;
DROP POLICY IF EXISTS "Allow public read" ON goods_receipts;

-- 8. Sites
DROP POLICY IF EXISTS "Allow public insert" ON sites;
DROP POLICY IF EXISTS "Allow public update" ON sites;
DROP POLICY IF EXISTS "Allow public read" ON sites;

-- 9. Staff Members
DROP POLICY IF EXISTS "Allow public delete staff" ON staff_members;
DROP POLICY IF EXISTS "Allow public insert staff" ON staff_members;
DROP POLICY IF EXISTS "Allow public update staff" ON staff_members;
DROP POLICY IF EXISTS "Allow public read staff" ON staff_members;
