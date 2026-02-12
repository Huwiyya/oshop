-- ============================================
-- SIMPLIFIED FIX: Remove p_is_hidden Parameter
-- ============================================
-- Date: 2026-02-09
-- Version: 2.0 (Simplified)
--
-- Problem: RPC has p_is_hidden parameter but TypeScript code doesn't pass it
-- Solution: Remove p_is_hidden from RPC signature OR make it always default to false
-- ============================================

BEGIN;

-- Drop existing function with ALL possible signatures
DROP FUNCTION IF EXISTS create_journal_entry_rpc(DATE, TEXT, TEXT, TEXT, JSONB, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS create_journal_entry_rpc(DATE, TEXT, TEXT, TEXT, JSONB) CASCADE;

-- Recreate WITHOUT p_is_hidden (simplified version)
CREATE OR REPLACE FUNCTION create_journal_entry_rpc(
    p_entry_date DATE,
    p_description TEXT,
    p_reference_type TEXT,
    p_reference_id TEXT,
    p_lines JSONB
)
RETURNS TEXT AS $func$
DECLARE
    new_entry_id TEXT;
    new_entry_number TEXT;
    rec JSONB;
    v_total_debit DECIMAL(19,4) := 0;
    v_total_credit DECIMAL(19,4) := 0;
    line_debit DECIMAL(19,4);
    line_credit DECIMAL(19,4);
    year_prefix TEXT;
    line_number INTEGER := 1;
BEGIN
    -- A. Calculate Totals from Lines
    FOR rec IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        line_debit := COALESCE((rec->>'debit')::DECIMAL, 0);
        line_credit := COALESCE((rec->>'credit')::DECIMAL, 0);
        
        v_total_debit := v_total_debit + line_debit;
        v_total_credit := v_total_credit + line_credit;
    END LOOP;

    -- B. Strict Balance Check
    IF abs(v_total_debit - v_total_credit) > 0.01 THEN
        RAISE EXCEPTION 'Journal Entry not balanced! Debit: %, Credit: %', v_total_debit, v_total_credit;
    END IF;

    -- C. Generate Entry Number (JE-YYYYMMDD-XXXX)
    year_prefix := to_char(p_entry_date, 'YYYYMMDD');
    new_entry_number := 'JE-' || year_prefix || '-' || substring(uuid_generate_v4()::text from 1 for 5);

    -- D. Insert Header (is_system_hidden always FALSE for manual entries)
    INSERT INTO journal_entries (
        id,
        entry_number,
        entry_date,
        description,
        reference_type,
        reference_id,
        total_debit,
        total_credit,
        status,
        is_system_hidden,
        created_at,
        updated_at
    ) VALUES (
        uuid_generate_v4()::text,
        new_entry_number,
        p_entry_date,
        p_description,
        COALESCE(p_reference_type, 'manual'),
        p_reference_id,
        v_total_debit,
        v_total_credit,
        'posted',
        FALSE,  -- Always false for this simplified version
        NOW(),
        NOW()
    ) RETURNING id INTO new_entry_id;

    -- E. Insert Lines
    FOR rec IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        -- Validate account exists
        IF NOT EXISTS (SELECT 1 FROM accounts WHERE id::TEXT = rec->>'accountId') THEN
            RAISE EXCEPTION 'Account ID % does not exist', rec->>'accountId';
        END IF;

        INSERT INTO journal_entry_lines (
            id,
            journal_entry_id,
            account_id,
            description,
            debit,
            credit,
            line_number,
            created_at
        ) VALUES (
            uuid_generate_v4()::text,
            new_entry_id,
            rec->>'accountId',
            COALESCE(rec->>'description', p_description),
            COALESCE((rec->>'debit')::DECIMAL, 0),
            COALESCE((rec->>'credit')::DECIMAL, 0),
            line_number,
            NOW()
        );
        
        line_number := line_number + 1;
    END LOOP;

    RETURN new_entry_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
DECLARE
    func_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO func_count 
    FROM pg_proc 
    WHERE proname = 'create_journal_entry_rpc';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SIMPLIFIED FIX APPLIED';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✓ create_journal_entry_rpc recreated WITHOUT p_is_hidden';
    RAISE NOTICE '✓ Function count: % (should be 1)', func_count;
    RAISE NOTICE '✓ All TypeScript code should now work without modification';
    RAISE NOTICE '';
    RAISE NOTICE 'Next: Test creating a journal entry';
    RAISE NOTICE '';
END $$;

COMMIT;
