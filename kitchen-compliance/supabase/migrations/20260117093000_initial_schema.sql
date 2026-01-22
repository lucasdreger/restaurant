-- Kitchen Compliance Database Schema
-- FSAI SC3 Cooling Compliance Tracking

-- Enable UUID extension

-- Sites table (restaurant locations)
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  kiosk_pin TEXT,
  alert_email TEXT,
  alert_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cooling sessions table (main tracking table)
CREATE TABLE IF NOT EXISTS cooling_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_category TEXT NOT NULL DEFAULT 'other',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soft_due_at TIMESTAMPTZ NOT NULL,
  hard_due_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'warning', 'overdue', 'closed', 'discarded')),
  close_action TEXT CHECK (close_action IN ('in_fridge', 'discarded', 'exception')),
  start_temperature DECIMAL(4,1),
  end_temperature DECIMAL(4,1),
  staff_name TEXT,
  closed_by TEXT,
  exception_reason TEXT,
  exception_approved_by TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cooling events table (audit log)
CREATE TABLE IF NOT EXISTS cooling_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES cooling_sessions(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('started', 'warning_triggered', 'overdue_triggered', 'closed', 'discarded', 'exception_added')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES cooling_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('warning', 'overdue')),
  message TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cooling_sessions_site_id ON cooling_sessions(site_id);
CREATE INDEX IF NOT EXISTS idx_cooling_sessions_status ON cooling_sessions(status);
CREATE INDEX IF NOT EXISTS idx_cooling_sessions_started_at ON cooling_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_cooling_sessions_closed_at ON cooling_sessions(closed_at);
CREATE INDEX IF NOT EXISTS idx_cooling_events_session_id ON cooling_events(session_id);
CREATE INDEX IF NOT EXISTS idx_cooling_events_site_id ON cooling_events(site_id);
CREATE INDEX IF NOT EXISTS idx_cooling_events_timestamp ON cooling_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_session_id ON alerts(session_id);

-- Row Level Security (RLS)
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooling_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooling_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for now (public access for kiosk mode)
CREATE POLICY "Allow public read" ON sites FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON sites FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON sites FOR UPDATE USING (true);

CREATE POLICY "Allow public read" ON cooling_sessions FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON cooling_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON cooling_sessions FOR UPDATE USING (true);

CREATE POLICY "Allow public read" ON cooling_events FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON cooling_events FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read" ON alerts FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON alerts FOR UPDATE USING (true);

-- Insert default demo site
INSERT INTO sites (id, name, address, kiosk_pin)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Demo Kitchen',
  '123 Restaurant Street',
  '1234'
) ON CONFLICT (id) DO NOTHING;
