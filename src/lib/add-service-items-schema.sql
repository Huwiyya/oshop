-- Add 'type' column to inventory_items table to distinguish between physical goods and services
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'product',
ADD CONSTRAINT check_item_type CHECK (type IN ('product', 'service'));

-- Add accounting mapping columns for service items
-- These are optional. If null, default system accounts (Sales/COGS) are used.
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS revenue_account_id UUID REFERENCES accounts(id),
ADD COLUMN IF NOT EXISTS expense_account_id UUID REFERENCES accounts(id);

-- Start with all existing items as 'product'
UPDATE inventory_items SET type = 'product' WHERE type IS NULL;
