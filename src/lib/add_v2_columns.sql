
-- Add description column
ALTER TABLE accounts_v2 ADD COLUMN IF NOT EXISTS description TEXT;

-- Add currency column with default 'LYD'
ALTER TABLE accounts_v2 ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'LYD';

-- Add boolean flags which might be useful/referenced later
ALTER TABLE accounts_v2 ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;
