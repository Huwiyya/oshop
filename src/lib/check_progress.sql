
SELECT count(*) as count, max(code) as last_code 
FROM accounts_v2 
WHERE parent_id = (SELECT account_id FROM system_accounts WHERE key = 'CUSTOMERS_CONTROL');
