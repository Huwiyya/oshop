-- First, check the current structure
SELECT * FROM managers_v4;

-- Add email column if it doesn't exist
ALTER TABLE managers_v4
ADD COLUMN IF NOT EXISTS email TEXT;

-- Copy id to email (since id contains the email in localStorage)
UPDATE managers_v4 
SET email = id;

-- Verify the update
SELECT * FROM managers_v4;
