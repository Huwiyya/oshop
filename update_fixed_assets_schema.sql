
-- Add columns to link specific accounts to each fixed asset
-- Note: accounts.id is TEXT, so we must use TEXT for the foreign key columns
ALTER TABLE fixed_assets
ADD COLUMN IF NOT EXISTS cost_account_id TEXT REFERENCES accounts(id),
ADD COLUMN IF NOT EXISTS accumulated_account_id TEXT REFERENCES accounts(id);
