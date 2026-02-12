-- Add sales_account_id to inventory_items
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS sales_account_id TEXT REFERENCES accounts(id);

-- Add comment for clarity
COMMENT ON COLUMN inventory_items.sales_account_id IS 'حساب المبيعات (Revenue) المرتبط بهذا الصنف';
COMMENT ON COLUMN inventory_items.inventory_account_id IS 'حساب المخزون (Asset) المرتبط بهذا الصنف';
COMMENT ON COLUMN inventory_items.cogs_account_id IS 'حساب تكلفة البضاعة المباعة (Expense) المرتبط بهذا الصنف';
