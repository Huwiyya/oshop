-- Direct test: Can we SELECT accounts 3, 4, 5?
-- Run this in Supabase SQL Editor to verify they can be queried

SELECT * FROM accounts_v2 WHERE code IN ('3', '4', '5');

-- Check if there's a filter causing issues
SELECT 
    code,
    name_ar,
    type_id,
    created_at,
    updated_at,
    (SELECT name_en FROM account_types_v2 WHERE id = accounts_v2.type_id) as type_name
FROM accounts_v2
ORDER BY code;

-- Count by creation date
SELECT 
    DATE(created_at) as creation_date,
    COUNT(*) as count
FROM accounts_v2
GROUP BY DATE(created_at)
ORDER BY creation_date DESC;
