-- Remove unintended public read policy from site_settings.
-- Keeps admin and scoped policies intact.

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON site_settings;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON site_settings;
DROP POLICY IF EXISTS "Allow read access for all users" ON site_settings;
