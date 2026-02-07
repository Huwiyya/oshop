-- 1. Add is_system_hidden column to journal_entries
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS is_system_hidden BOOLEAN DEFAULT FALSE;

-- 2. Update create_journal_entry_rpc to support the new flag
-- We update the signature to include p_is_hidden
CREATE OR REPLACE FUNCTION create_journal_entry_rpc(
    p_entry_date DATE,
    p_description TEXT,
    p_reference_type TEXT,
    p_reference_id TEXT,
    p_lines JSONB,
    p_is_hidden BOOLEAN DEFAULT FALSE -- New parameter
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
    -- A. Calculate Totals & Verify Balance
    FOR rec IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        line_debit := COALESCE((rec->>'debit')::DECIMAL, 0);
        line_credit := COALESCE((rec->>'credit')::DECIMAL, 0);
        
        v_total_debit := v_total_debit + line_debit;
        v_total_credit := v_total_credit + line_credit;
    END LOOP;

    -- Strict Balance Check
    IF abs(v_total_debit - v_total_credit) > 0.0001 THEN
        RAISE EXCEPTION 'Journal Entry is not balanced! Debit: %, Credit: %', v_total_debit, v_total_credit;
    END IF;

    -- B. Generate Entry Number
    year_prefix := to_char(p_entry_date, 'YYYYMMDD');
    new_entry_number := 'JE-' || year_prefix || '-' || floor(random() * 10000)::text;
    
    -- C. Insert Header
    INSERT INTO journal_entries (
        entry_number,
        entry_date,
        description,
        reference_type,
        reference_id,
        total_debit,
        total_credit,
        status,
        is_system_hidden, -- New column
        created_at,
        updated_at
    ) VALUES (
        new_entry_number,
        p_entry_date,
        p_description,
        COALESCE(p_reference_type, 'manual'),
        p_reference_id,
        v_total_debit,
        v_total_credit,
        'posted',
        p_is_hidden, -- New value
        NOW(),
        NOW()
    ) RETURNING id INTO new_entry_id;

    -- D. Insert Lines
    FOR rec IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        INSERT INTO journal_entry_lines (
            entry_id,
            journal_entry_id,
            account_id,
            description,
            debit,
            credit
        ) VALUES (
            new_entry_id,
            new_entry_id,
            rec->>'accountId',
            COALESCE(rec->>'description', p_description),
            COALESCE((rec->>'debit')::DECIMAL, 0),
            COALESCE((rec->>'credit')::DECIMAL, 0)
        );
    END LOOP;

    RETURN new_entry_id;
END;
$func$ LANGUAGE plpgsql;
