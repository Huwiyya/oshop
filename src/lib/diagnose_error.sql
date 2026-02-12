-- Diagnostic Script to identify RPC failure reason
-- Run this in your Supabase SQL Editor or via psql

BEGIN;

DO $$
DECLARE
    v_ext_exists boolean;
    v_acc_id text;
    v_result text;
BEGIN
    RAISE NOTICE 'Starting Diagnosis...';

    -- 1. Check for uuid-ossp extension
    SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') INTO v_ext_exists;
    IF NOT v_ext_exists THEN
        RAISE NOTICE '❌ Extension [uuid-ossp] is MISSING. Please run: CREATE EXTENSION "uuid-ossp";';
    ELSE
        RAISE NOTICE '✅ Extension [uuid-ossp] is present.';
    END IF;

    -- 2. Check table definition
    PERFORM 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'is_system_hidden';
    IF NOT FOUND THEN
        RAISE NOTICE '❌ Column [is_system_hidden] is MISSING in journal_entries.';
    ELSE
        RAISE NOTICE '✅ Column [is_system_hidden] is present.';
    END IF;

    -- 3. Get a valid account ID to test with
    SELECT id::text INTO v_acc_id FROM accounts LIMIT 1;
    
    IF v_acc_id IS NULL THEN
        RAISE NOTICE '⚠️ No accounts found in [accounts] table. Cannot test RPC.';
    ELSE
        RAISE NOTICE 'ℹ️ Testing RPC with Account ID: %', v_acc_id;

        -- 4. Attempt to run the RPC with dummy data
        -- We use a BEGIN/EXCEPTION block to catch the specifc error
        BEGIN
            v_result := create_journal_entry_rpc(
                CURRENT_DATE,
                'DIAGNOSTIC_TEST_ENTRY',
                'manual',
                NULL,
                jsonb_build_array(
                    jsonb_build_object('accountId', v_acc_id, 'debit', 100, 'credit', 0),
                    jsonb_build_object('accountId', v_acc_id, 'debit', 0, 'credit', 100)
                )
            );
            RAISE NOTICE '✅ RPC Execution SUCCESS! Entry ID: %', v_result;
            
            -- Force error to rollback transaction so we don't save test data
            RAISE EXCEPTION 'Test successful, rolling back.';
        EXCEPTION 
            WHEN others THEN
                IF SQLERRM = 'Test successful, rolling back.' THEN
                    RAISE NOTICE '✅ Diagnosis Complete: RPC works correctly.';
                ELSE
                    RAISE NOTICE '❌ RPC Execution FAILED with error: %', SQLERRM;
                    RAISE NOTICE '   Detail: %', SQLSTATE;
                END IF;
        END;
    END IF;

END $$;

ROLLBACK;
