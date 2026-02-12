-- Add product_id and quantity to journal_lines_v2
ALTER TABLE public.journal_lines_v2 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products_v2(id),
ADD COLUMN IF NOT EXISTS quantity DECIMAL(20, 4) DEFAULT 0;

-- Update the RPC function to handle these new fields
CREATE OR REPLACE FUNCTION create_journal_entry_rpc(
    p_date DATE,
    p_description TEXT,
    p_reference_type TEXT, -- source_type
    p_reference_id TEXT,    -- source_id
    p_lines JSONB
)
RETURNS UUID AS $$
DECLARE
    v_entry_id UUID;
    v_entry_number TEXT;
    v_year TEXT;
    v_count INT;
    v_line JSONB;
    v_total_debit DECIMAL(19,4) := 0;
    v_total_credit DECIMAL(19,4) := 0;
    v_current_balance DECIMAL(19,4);
    v_account_type TEXT;
BEGIN
    -- 1. Validate inputs
    IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'Journal entry must have at least one line';
    END IF;

    -- 2. Calculate totals and verify balance
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_total_debit := v_total_debit + COALESCE((v_line->>'debit')::DECIMAL, 0);
        v_total_credit := v_total_credit + COALESCE((v_line->>'credit')::DECIMAL, 0);
    END LOOP;

    -- Check if balanced
    IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
        RAISE EXCEPTION 'Journal entry is not balanced. Debit: %, Credit: %', v_total_debit, v_total_credit;
    END IF;

    -- 3. Generate entry number (JE-YYYY-XXXX)
    v_year := to_char(p_date, 'YYYY');
    SELECT COUNT(*) + 1 INTO v_count 
    FROM journal_entries_v2 
    WHERE entry_number LIKE 'JE-' || v_year || '-%';
    
    v_entry_number := 'JE-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');

    -- 4. Insert journal entry header
    INSERT INTO journal_entries_v2 (
        entry_number,
        date,
        description,
        source_type,
        source_id,
        total_debit,
        total_credit,
        status,
        created_at
    ) VALUES (
        v_entry_number,
        p_date,
        p_description,
        COALESCE(p_reference_type, 'manual'),
        p_reference_id::UUID,
        v_total_debit,
        v_total_credit,
        'posted',
        NOW()
    ) RETURNING id INTO v_entry_id;

    -- 5. Insert journal lines and update account balances
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        -- Insert line
        INSERT INTO journal_lines_v2 (
            journal_id,
            account_id,
            description,
            debit,
            credit,
            product_id,    -- NEW FIELD
            quantity,      -- NEW FIELD
            created_at
        ) VALUES (
            v_entry_id,
            (v_line->>'account_id')::UUID,
            COALESCE(v_line->>'description', p_description),
            COALESCE((v_line->>'debit')::DECIMAL, 0),
            COALESCE((v_line->>'credit')::DECIMAL, 0),
            (v_line->>'product_id')::UUID,           -- NEW FIELD
            COALESCE((v_line->>'quantity')::DECIMAL, 0), -- NEW FIELD
            NOW()
        );

        -- Update account balance
        -- Get current balance and account type
        SELECT current_balance, account_types_v2.normal_balance 
        INTO v_current_balance, v_account_type
        FROM accounts_v2
        LEFT JOIN account_types_v2 ON accounts_v2.type_id = account_types_v2.id
        WHERE accounts_v2.id = (v_line->>'account_id')::UUID;

        -- Calculate new balance based on normal balance
        IF v_account_type = 'debit' THEN
            v_current_balance := COALESCE(v_current_balance, 0) + 
                COALESCE((v_line->>'debit')::DECIMAL, 0) - 
                COALESCE((v_line->>'credit')::DECIMAL, 0);
        ELSE
            v_current_balance := COALESCE(v_current_balance, 0) + 
                COALESCE((v_line->>'credit')::DECIMAL, 0) - 
                COALESCE((v_line->>'debit')::DECIMAL, 0);
        END IF;

        -- Update account
        UPDATE accounts_v2 
        SET current_balance = v_current_balance,
            updated_at = NOW()
        WHERE id = (v_line->>'account_id')::UUID;
    END LOOP;

    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
