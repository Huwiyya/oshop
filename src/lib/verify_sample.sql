
SELECT code, name_ar, description 
FROM accounts_v2 
WHERE parent_id = (SELECT account_id FROM system_accounts WHERE key = 'CUSTOMERS_CONTROL')
ORDER BY code DESC
LIMIT 5;
