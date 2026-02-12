-- Diagnostic Script V2
-- This script returns a result set so you can see the output even if NOTICES are hidden.

BEGIN;

WITH test_data AS (
    SELECT 
        CURRENT_DATE as t_date,
        'DIAGNOSTIC_TEST_ENTRY_V2' as t_desc,
        (SELECT id::text FROM accounts LIMIT 1) as t_acc_id
),
rpc_test AS (
    -- We try to run the RPC. If it fails, the transaction aborts, so we can't easily catch it in a simple SELECT.
    -- Instead, we will check prerequisites.
    SELECT 
        CASE 
            WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN '✅ INSTALLED' 
            ELSE '❌ MISSING' 
        END as uuid_extension,
        
        CASE 
            WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'is_system_hidden') THEN '✅ PRESENT' 
            ELSE '❌ MISSING' 
        END as column_is_system_hidden,
        
        (SELECT count(*) FROM pg_proc WHERE proname = 'create_journal_entry_rpc') as rpc_function_count
)
SELECT 
    uuid_extension,
    column_is_system_hidden,
    rpc_function_count,
    CASE 
        WHEN uuid_extension = '❌ MISSING' THEN 'CRITICAL: Install uuid-ossp extension'
        WHEN column_is_system_hidden = '❌ MISSING' THEN 'CRITICAL: Run database migrations'
        WHEN rpc_function_count = 0 THEN 'CRITICAL: Function create_journal_entry_rpc not found'
        ELSE 'Prerequisites OK. If 500 persists, check Server Logs or Service Role Key.'
    END as diagnosis
FROM rpc_test;

ROLLBACK;
