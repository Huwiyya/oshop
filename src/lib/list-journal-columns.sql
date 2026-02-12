SELECT 
    table_name,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('journal_entries', 'journal_entry_lines')
ORDER BY table_name, ordinal_position;
