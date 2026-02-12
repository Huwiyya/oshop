-- Don't delete! Just check what exists and what has children

-- 1. Show all level 1 accounts
SELECT 
    a.code, 
    a.name_ar, 
    a.level,
    a.is_group,
    COUNT(children.id) as child_count
FROM accounts_v2 a
LEFT JOIN accounts_v2 children ON children.parent_id = a.id
WHERE a.level = 1
GROUP BY a.id, a.code, a.name_ar, a.level, a.is_group
ORDER BY a.code;

-- 2. Check if accounts 3, 4, 5 have the exact same structure as 1, 2
SELECT 
    code,
    name_ar,
    type_id,
    parent_id,
    level,
    is_group,
    current_balance,
    created_at,
    updated_at
FROM accounts_v2
WHERE code IN ('1', '2', '3', '4', '5')
ORDER BY code;
