-- Settings & Management Features Schema

-- 1. Staff Members Table
CREATE TABLE IF NOT EXISTS staff_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('manager', 'chef', 'staff')),
    initials TEXT,
    pin TEXT, -- For simple kiosk authentication
    active BOOLEAN DEFAULT TRUE,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for staff lookups
CREATE INDEX IF NOT EXISTS idx_staff_members_site ON staff_members(site_id);

-- 2. Food Item Presets Table (for standardizing menu items in cooling)
CREATE TABLE IF NOT EXISTS food_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE, -- Nullable if global preset
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('sauce', 'soup', 'meat', 'vegetable', 'other')),
    icon TEXT, -- Emoji or icon identifier
    use_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for food items
CREATE INDEX IF NOT EXISTS idx_food_items_site ON food_items(site_id);

-- 3. RLS Policies
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_items ENABLE ROW LEVEL SECURITY;

-- Simple public policies for demo/dev (mirroring existing pattern)
CREATE POLICY "Allow public read staff" ON staff_members FOR SELECT USING (true);
CREATE POLICY "Allow public insert staff" ON staff_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update staff" ON staff_members FOR UPDATE USING (true);
CREATE POLICY "Allow public delete staff" ON staff_members FOR DELETE USING (true);

CREATE POLICY "Allow public read food" ON food_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert food" ON food_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update food" ON food_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete food" ON food_items FOR DELETE USING (true);

-- 4. Seed Data function (optional helpers)
