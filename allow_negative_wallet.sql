-- Remove the constraint that prevents negative wallet balance
ALTER TABLE users_v4 DROP CONSTRAINT IF EXISTS users_v4_wallet_non_negative;

-- Optional: Add a comment ensuring debt is tracked via negative balance
COMMENT ON COLUMN users_v4."walletBalance" IS 'Can be negative to represent user debt';
