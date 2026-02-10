-- Add code column to fridges
ALTER TABLE fridges 
ADD COLUMN IF NOT EXISTS code TEXT;

-- Add UNIQUE constraints ensuring codes are unique PER SITE
-- We use a partial index or constraint. Standard constraint is cleaner:

-- For Fridges
ALTER TABLE fridges 
DROP CONSTRAINT IF EXISTS fridges_site_id_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fridges_site_code 
ON fridges(site_id, code) 
WHERE code IS NOT NULL AND active = true; 
-- Note: We only care about active fridges? Or all? Usually uniqueness should persist.
-- Let's ignore 'active' for uniqueness to avoid reusing codes of deleted items if users want that history?
-- User said: "based on the latest number already used" -> implies we keep history.
-- So unique across ALL (active and inactive) is safer to avoid collisions with historical logs.

DROP INDEX IF EXISTS idx_fridges_site_code; -- Drop the partial one if I changed my mind
ALTER TABLE fridges ADD CONSTRAINT fridges_site_id_code_key UNIQUE (site_id, code);


-- For Staff
-- staff_members already has staff_code
ALTER TABLE staff_members 
DROP CONSTRAINT IF EXISTS staff_members_site_id_staff_code_key;

ALTER TABLE staff_members ADD CONSTRAINT staff_members_site_id_staff_code_key UNIQUE (site_id, staff_code);
