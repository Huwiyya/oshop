
SELECT a.code, a.name_ar, a.id 
FROM system_accounts sa 
JOIN accounts_v2 a ON sa.account_id = a.id 
WHERE sa.key = 'CUSTOMERS_CONTROL';
