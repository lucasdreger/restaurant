-- ============================================
-- Migration: Customers/Subscribers Table
-- Purpose: Store customer sign-ups and subscription info
-- ============================================

-- 1. Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Owner/Contact Info
    owner_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    
    -- Restaurant Info
    restaurant_name TEXT NOT NULL,
    restaurant_type TEXT DEFAULT 'restaurant',
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'Ireland',
    
    -- Subscription Info
    subscription_tier TEXT NOT NULL DEFAULT 'tier1' CHECK (subscription_tier IN ('tier1', 'tier2', 'tier3')),
    trial_ends_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'cancelled', 'expired', 'pending')),
    
    -- Stripe Integration (for future use)
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    
    -- Branding (for tier2+ customers)
    branding_enabled BOOLEAN DEFAULT false,
    brand_logo_url TEXT,
    brand_primary_color TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- 3. Create index on status for filtering active customers
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

-- 4. Create index on subscription_tier for analytics
CREATE INDEX IF NOT EXISTS idx_customers_subscription_tier ON customers(subscription_tier);

-- 5. Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies
-- Customers can read their own data
CREATE POLICY "customers_read_own" ON customers
    FOR SELECT
    USING (auth.uid()::text = id::text OR auth.jwt()->>'role' = 'admin');

-- Customers can update their own data
CREATE POLICY "customers_update_own" ON customers
    FOR UPDATE
    USING (auth.uid()::text = id::text OR auth.jwt()->>'role' = 'admin');

-- Allow public inserts for sign-up (no auth required)
CREATE POLICY "customers_public_insert" ON customers
    FOR INSERT
    WITH CHECK (true);

-- 7. Create updated_at trigger
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customers_updated_at_trigger
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_customers_updated_at();

-- 8. Add comment for documentation
COMMENT ON TABLE customers IS 'Stores customer sign-ups, subscription info, and branding settings';
COMMENT ON COLUMN customers.subscription_tier IS 'tier1=Starter, tier2=Professional, tier3=Enterprise';
COMMENT ON COLUMN customers.branding_enabled IS 'Custom branding available for tier2+ subscriptions';
