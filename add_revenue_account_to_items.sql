-- Add revenue_account_id to inventory_items table
-- Note: accounts.id is TEXT, so we must use TEXT here as well, not UUID.
ALTER TABLE inventory_items 
ADD COLUMN revenue_account_id TEXT REFERENCES accounts(id);

-- Add expense_account_id (optional, for COGS)
ALTER TABLE inventory_items 
ADD COLUMN expense_account_id TEXT REFERENCES accounts(id);
