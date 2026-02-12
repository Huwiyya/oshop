-- Check managers table structure and data
SELECT * FROM managers_v4;

-- If email column doesn't exist or is NULL, update it
UPDATE managers_v4 
SET email = id 
WHERE email IS NULL OR email = '';

-- Verify the update
SELECT id, email, password, name, role FROM managers_v4;
