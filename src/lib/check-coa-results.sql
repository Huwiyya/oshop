-- check-coa-results.sql
SELECT 'Account Types Count: ' || COUNT(*) FROM account_types;
SELECT 'Accounts Count: ' || COUNT(*) FROM accounts;
SELECT id, account_code, name_ar, cash_flow_type FROM accounts WHERE account_code IN ('1111', '1112');
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'cash_flow_type';
