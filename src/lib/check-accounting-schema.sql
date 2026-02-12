SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name IN ('accounts', 'account_types')
ORDER BY table_name, ordinal_position;
