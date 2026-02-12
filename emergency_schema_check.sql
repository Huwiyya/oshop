-- Emergency CHECK: Do accounts 3,4,5 violate any constraints?

-- 1. Check column info
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'accounts_v2'
ORDER BY ordinal_position;

-- 2. Show all constraints
SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'accounts_v2';

-- 3. Direct count
SELECT COUNT(*) as total_accounts FROM accounts_v2;
SELECT COUNT(*) as missing_accounts FROM accounts_v2 WHERE code IN ('3','4','5');

-- 4. Try to SELECT with the exact same join as Supabase
SELECT 
    a.*,
    row_to_json(t.*) as account_type
FROM accounts_v2 a
LEFT JOIN account_types_v2 t ON a.type_id = t.id
WHERE a.code IN ('1', '2', '3', '4', '5', '12')
ORDER BY a.code;

-- 5. Check for NULL type_ids
SELECT code, name_ar, type_id FROM accounts_v2 WHERE type_id IS NULL;
