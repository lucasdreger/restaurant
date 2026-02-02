-- =====================================================
-- Delivery Images - Enhanced Storage for Traceability
-- Supports delivery notes and protein/traceability labels
-- =====================================================

-- Create delivery_images table for storing all types of delivery documentation
CREATE TABLE IF NOT EXISTS delivery_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  
  -- Image type classification
  image_type TEXT NOT NULL CHECK (image_type IN ('delivery_note', 'protein_label', 'temperature_log', 'other')),
  
  -- Storage info
  storage_path TEXT NOT NULL,
  original_filename TEXT,
  compressed_size_bytes INT,
  original_size_bytes INT,
  mime_type TEXT DEFAULT 'image/jpeg',
  
  -- Image metadata
  page_number INT DEFAULT 1,
  description TEXT,
  
  -- Protein label specific fields (when image_type = 'protein_label')
  product_name TEXT,
  batch_number TEXT,
  use_by_date DATE,
  supplier_code TEXT,
  
  -- Processing info
  ocr_processed BOOLEAN DEFAULT FALSE,
  ocr_text TEXT,
  
  -- Timestamps
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_delivery_images_receipt_id ON delivery_images(receipt_id);
CREATE INDEX idx_delivery_images_type ON delivery_images(image_type);
CREATE INDEX idx_delivery_images_batch ON delivery_images(batch_number) WHERE batch_number IS NOT NULL;
CREATE INDEX idx_delivery_images_captured_at ON delivery_images(captured_at DESC);

-- Row Level Security
ALTER TABLE delivery_images ENABLE ROW LEVEL SECURITY;

-- Updated At Trigger
CREATE TRIGGER delivery_images_updated_at
  BEFORE UPDATE ON delivery_images
  FOR EACH ROW
  EXECUTE FUNCTION update_goods_receipt_updated_at();

-- Comments for documentation
COMMENT ON TABLE delivery_images IS 'Stores compressed images for delivery documentation including delivery notes and protein/traceability labels';
COMMENT ON COLUMN delivery_images.image_type IS 'Type of image: delivery_note, protein_label, temperature_log, or other';
COMMENT ON COLUMN delivery_images.storage_path IS 'Path in Supabase storage bucket';
COMMENT ON COLUMN delivery_images.batch_number IS 'Batch/lot number from protein traceability label';
