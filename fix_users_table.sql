-- Add walletBalance column if it doesn't exist
ALTER TABLE users_v4 
ADD COLUMN IF NOT EXISTS "walletBalance" NUMERIC(15, 2) DEFAULT 0;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload config';

-- Verify the column exists (just for output)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users_v4' AND column_name = 'walletBalance';
