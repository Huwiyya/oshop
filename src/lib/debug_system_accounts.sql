
-- Check if 1120 exists
SELECT * FROM accounts_v2 WHERE code = '1120';

-- Check if 2110 exists
SELECT * FROM accounts_v2 WHERE code = '2110';

-- Check all system accounts
SELECT * FROM system_accounts;

-- Check all accounts_v2 to see what acts as control
SELECT code, name_ar, name_en, type_id FROM accounts_v2 ORDER BY code;
