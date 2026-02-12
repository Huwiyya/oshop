
SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_table = 'system_accounts';
