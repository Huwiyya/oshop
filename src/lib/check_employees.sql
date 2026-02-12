
-- Check V1 Accounts
SELECT id, code, name_ar, account_code FROM accounts WHERE account_code LIKE '213%' LIMIT 5;

-- Check V2 Accounts
SELECT id, code, name_ar, parent_id FROM accounts_v2 WHERE code LIKE '213%' OR name_ar LIKE '%موظف%' LIMIT 5;

-- Check System Accounts for Employees
SELECT key, account_id FROM system_accounts WHERE key LIKE 'EMPLOYEES%';
