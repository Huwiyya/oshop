
-- Check accounts_v2 columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'accounts_v2';

-- Check if customers/suppliers tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE '%customer%' OR table_name LIKE '%supplier%';
