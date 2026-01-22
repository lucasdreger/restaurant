-- Fridge Temperature Logging Feature
-- Tracks fridges per venue with configurable names
-- Logs temperature readings for FSAI/HACCP compliance

-- Fridges table - tracks fridges per site
CREATE TABLE IF NOT EXISTS fridges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Fridge 1',
  sort_order INTEGER DEFAULT 0,
  min_temp NUMERIC(4,1) DEFAULT 0,
  max_temp NUMERIC(4,1) DEFAULT 5,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Temperature logs table - stores readings
CREATE TABLE IF NOT EXISTS fridge_temp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  fridge_id UUID NOT NULL REFERENCES fridges(id) ON DELETE CASCADE,
  temperature NUMERIC(4,1) NOT NULL,
  recorded_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  recorded_by_name TEXT,
  notes TEXT,
  is_compliant BOOLEAN GENERATED ALWAYS AS (temperature >= 0 AND temperature <= 5) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_fridges_site ON fridges(site_id);
CREATE INDEX IF NOT EXISTS idx_fridge_temp_logs_site ON fridge_temp_logs(site_id);
CREATE INDEX IF NOT EXISTS idx_fridge_temp_logs_fridge ON fridge_temp_logs(fridge_id);
CREATE INDEX IF NOT EXISTS idx_fridge_temp_logs_created ON fridge_temp_logs(created_at DESC);

-- RLS Policies
ALTER TABLE fridges ENABLE ROW LEVEL SECURITY;
ALTER TABLE fridge_temp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fridges_read" ON fridges FOR SELECT USING (true);
CREATE POLICY "fridges_write" ON fridges FOR ALL USING (true);
CREATE POLICY "fridge_temp_logs_read" ON fridge_temp_logs FOR SELECT USING (true);
CREATE POLICY "fridge_temp_logs_write" ON fridge_temp_logs FOR ALL USING (true);
