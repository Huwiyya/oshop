
SELECT count(*) as count, min(name_ar) as example_name 
FROM accounts_v2 
WHERE parent_id = (SELECT account_id FROM system_accounts WHERE key = 'EMPLOYEES_PAYABLE');
