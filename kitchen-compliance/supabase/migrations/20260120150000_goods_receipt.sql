-- =====================================================
-- Goods Receipt Feature - HACCP Delivery Intake Tracking
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Goods Receipts Table (Header)
CREATE TABLE IF NOT EXISTS goods_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  invoice_number TEXT,
  invoice_date DATE,
  received_by_staff_id UUID REFERENCES staff_members(id),
  received_by_name TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  overall_temperature DECIMAL(4,1),
  temperature_compliant BOOLEAN DEFAULT TRUE,
  ocr_raw_text TEXT,
  ocr_confidence DECIMAL(3,2),
  invoice_image_url TEXT,
  notes TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('draft', 'completed', 'flagged', 'voided')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Goods Receipt Items Table (Line Items)
CREATE TABLE IF NOT EXISTS goods_receipt_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'units',
  temperature DECIMAL(4,1),
  temperature_compliant BOOLEAN DEFAULT TRUE,
  category TEXT DEFAULT 'ambient' CHECK (category IN ('chilled', 'frozen', 'ambient', 'dry', 'produce', 'meat', 'dairy', 'seafood')),
  notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_goods_receipts_site_id ON goods_receipts(site_id);
CREATE INDEX idx_goods_receipts_received_at ON goods_receipts(received_at DESC);
CREATE INDEX idx_goods_receipts_supplier ON goods_receipts(supplier_name);
CREATE INDEX idx_goods_receipt_items_receipt_id ON goods_receipt_items(receipt_id);

-- Row Level Security
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;

-- Updated At Trigger
CREATE OR REPLACE FUNCTION update_goods_receipt_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER goods_receipts_updated_at
  BEFORE UPDATE ON goods_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_goods_receipt_updated_at();
