-- Direct Supabase test query (run in Supabase SQL Editor)
-- This should show ALL accounts with their type information

SELECT 
    a.*,
    json_build_object(
        'id', t.id,
        'name_ar', t.name_ar,
        'name_en', t.name_en,
        'category', t.category,
        'normal_balance', t.normal_balance
    ) as account_type
FROM accounts_v2 a
LEFT JOIN account_types_v2 t ON a.type_id = t.id
ORDER BY a.code ASC;

-- Count check
SELECT 
    'Total accounts' as check_type,
    COUNT(*) as count
FROM accounts_v2

UNION ALL

SELECT 
    'Accounts 3,4,5' as check_type,
    COUNT(*) as count
FROM accounts_v2
WHERE code IN ('3', '4', '5');
