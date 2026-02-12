
-- Verify Top Level Accounts
SELECT code, name_en, level, type_id FROM accounts_v2 WHERE level = 1 ORDER BY code;

-- Verify Cash & Bank Controls
SELECT code, name_en, level, parent_id FROM accounts_v2 WHERE code IN ('1110', '1111') ORDER BY code;

-- Verify System Accounts Mapping
SELECT key, account_id FROM system_accounts WHERE key IN ('CUSTOMERS_CONTROL', 'SUPPLIERS_CONTROL', 'EMPLOYEES_PAYABLE');
