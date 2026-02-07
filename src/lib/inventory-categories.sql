-- Create Inventory Categories Table
CREATE TABLE IF NOT EXISTS inventory_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    revenue_account_id UUID REFERENCES accounts(id),
    cogs_account_id UUID REFERENCES accounts(id),
    inventory_account_id UUID REFERENCES accounts(id), -- For Purchase Invoices
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add category_id to inventory_items
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES inventory_categories(id);

-- Enable RLS
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON inventory_categories
    FOR ALL USING (auth.role() = 'authenticated');
