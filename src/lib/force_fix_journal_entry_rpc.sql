-- Force Fix for Journal Entry RPC (Final Robust Version)
-- Goal: Standardize Journal Entry creation with strict validation and correct schema usage.
-- Features:
-- 1. Calculates totals from lines (trusted source).
-- 2. Enforces strict debit=credit balance check.
-- 3. Generates entry_number automatically.
-- 4. Uses correct 'journal_entry_id' column for lines.
-- 5. Handles TEXT IDs properly.
-- 6. Returns TEXT ID.

BEGIN;

DROP FUNCTION IF EXISTS create_journal_entry_rpc(DATE, TEXT, TEXT, TEXT, JSONB, BOOLEAN);

CREATE OR REPLACE FUNCTION create_journal_entry_rpc(
    p_entry_date DATE,
    p_description TEXT,
    p_reference_type TEXT,
    p_reference_id TEXT,
    p_lines JSONB,
    p_is_hidden BOOLEAN DEFAULT FALSE
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
BEGIN
    -- A. Calculate Totals & Verify Balance from Lines
    FOR rec IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        line_debit := COALESCE((rec->>'debit')::DECIMAL, 0);
        line_credit := COALESCE((rec->>'credit')::DECIMAL, 0);
        
        v_total_debit := v_total_debit + line_debit;
        v_total_credit := v_total_credit + line_credit;
    END LOOP;

    -- Strict Balance Check (Allowing small float precision error if any, though DECIMAL should be exact)
    IF abs(v_total_debit - v_total_credit) > 0.001 THEN
        RAISE EXCEPTION 'Journal Entry is not balanced! Debit: %, Credit: %', v_total_debit, v_total_credit;
    END IF;

    -- B. Generate Entry Number (JE-YYYYMMDD-XXXX)
    year_prefix := to_char(p_entry_date, 'YYYYMMDD');
    -- Using a random suffix to avoid collision, realistically should use a sequence but this works for now
    new_entry_number := 'JE-' || year_prefix || '-' || substring(uuid_generate_v4()::text from 1 for 4);

    -- C. Insert Header
    -- Note: ID is TEXT, using uuid_generate_v4() cast to text
    -- Status defaults to 'posted'
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
        COALESCE(p_is_hidden, false),
        NOW(),
        NOW()
    ) RETURNING id INTO new_entry_id;

    -- D. Insert Lines
    -- Using 'journal_entry_id' as confirmed by schema
    FOR rec IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        INSERT INTO journal_entry_lines (
            id,
            journal_entry_id,
            account_id,
            description,
            debit,
            credit,
            created_at
        ) VALUES (
            uuid_generate_v4()::text,
            new_entry_id,
            rec->>'accountId',
            COALESCE(rec->>'description', p_description),
            COALESCE((rec->>'debit')::DECIMAL, 0),
            COALESCE((rec->>'credit')::DECIMAL, 0),
            NOW()
        );
    END LOOP;

    -- E. Return ID
    RETURN new_entry_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
