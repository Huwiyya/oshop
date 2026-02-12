
SELECT count(*) as total_customers, min(code) as first_code, max(code) as last_code 
FROM accounts_v2 
WHERE parent_id = (SELECT account_id FROM system_accounts WHERE key = 'CUSTOMERS_CONTROL');

SELECT code, name_ar, description FROM accounts_v2 
WHERE parent_id = (SELECT account_id FROM system_accounts WHERE key = 'CUSTOMERS_CONTROL') 
LIMIT 5;
