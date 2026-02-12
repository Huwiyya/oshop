-- Add related_user_id to link transactions to specific customers/users
ALTER TABLE accounting_transactions 
ADD COLUMN IF NOT EXISTS related_user_id TEXT; -- referencing users_v4(id), but using TEXT to match potential loose typing or manual entries

CREATE INDEX IF NOT EXISTS idx_accounting_trx_user ON accounting_transactions(related_user_id);
