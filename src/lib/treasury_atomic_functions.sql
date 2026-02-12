-- ============================================================================
-- ATOMIC TREASURY FUNCTIONS FOR RECEIPTS AND PAYMENTS
-- ============================================================================
-- These functions ensure that receipts and payments create journal entries
-- atomically in a single transaction.

-- ============================================================================
-- CREATE RECEIPT ATOMIC
-- ============================================================================
CREATE OR REPLACE FUNCTION create_receipt_atomic(
    p_date DATE,
    p_treasury_account_id UUID,
    p_amount DECIMAL(15,2),
    p_description TEXT,
    p_customer_account_id UUID DEFAULT NULL,
    p_lines JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE (
    receipt_id UUID,
    receipt_number TEXT,
    journal_entry_id UUID,
    journal_entry_number TEXT
) 
LANGUAGE plpgsql
AS $$
DECLARE
    v_receipt_id UUID;
    v_receipt_number TEXT;
    v_journal_entry_id UUID;
    v_journal_entry_number TEXT;
    v_line JSONB;
    v_journal_lines JSONB;
BEGIN
    -- 0. Generate receipt number
    v_receipt_number := 'REC-' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '-' || substring(uuid_generate_v4()::text from 1 for 4);

    -- 1. Validate inputs
    -- Either customer_account_id OR lines must be provided
    IF p_customer_account_id IS NULL AND (p_lines IS NULL OR jsonb_array_length(p_lines) = 0) THEN
        RAISE EXCEPTION 'Either customer_account_id or lines must be provided';
    END IF;
    
    -- 2. Prepare journal lines
    -- Receipt: Debit Treasury, Credit Revenue/Customer
    
    -- Line 1: Debit Treasury (Cash In)
    v_journal_lines := jsonb_build_array(
        jsonb_build_object(
            'account_id', p_treasury_account_id,
            'description', p_description,
            'debit', p_amount,
            'credit', 0
        )
    );
    
    -- Line 2+: Credit Revenue/Customer
    IF p_customer_account_id IS NOT NULL THEN
        -- Simple receipt from one account
        v_journal_lines := v_journal_lines || jsonb_build_object(
            'account_id', p_customer_account_id,
            'description', p_description,
            'debit', 0,
            'credit', p_amount
        );
    ELSE
        -- Split receipt
        FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
        LOOP
            v_journal_lines := v_journal_lines || jsonb_build_object(
                'account_id', (v_line->>'account_id')::UUID,
                'description', COALESCE(v_line->>'description', p_description),
                'debit', 0,
                'credit', (v_line->>'amount')::DECIMAL
            );
        END LOOP;
    END IF;
    
    -- 3. Create journal entry using RPC (returns only id)
    v_journal_entry_id := create_journal_entry_rpc(
        p_date := p_date,
        p_description := 'Receipt: ' || p_description,
        p_reference_type := 'receipt',
        p_reference_id := NULL, -- Will update after creating receipt
        p_lines := v_journal_lines
    );
    
    -- 4. Create receipt record
    INSERT INTO receipts_v2 (
        receipt_number,
        date,
        customer_account_id,
        treasury_account_id,
        amount,
        description,
        status,
        journal_entry_id
    ) VALUES (
        v_receipt_number,
        p_date,
        p_customer_account_id,
        p_treasury_account_id,
        p_amount,
        p_description,
        'posted',
        v_journal_entry_id
    ) RETURNING id INTO v_receipt_id;
    
    -- 5. Link journal entry to receipt
    UPDATE journal_entries_v2
    SET source_id = v_receipt_id,
        source_type = 'receipt'
    WHERE id = v_journal_entry_id;
    
    -- 6. Insert receipt lines
    IF p_customer_account_id IS NOT NULL THEN
        INSERT INTO receipt_lines_v2 (
            receipt_id,
            account_id,
            amount,
            description
        ) VALUES (
            v_receipt_id,
            p_customer_account_id,
            p_amount,
            p_description
        );
    ELSE
        -- Insert from lines JSON
        INSERT INTO receipt_lines_v2 (
            receipt_id,
            account_id,
            amount,
            description
        )
        SELECT 
            v_receipt_id,
            (line->>'account_id')::UUID,
            (line->>'amount')::decimal,
            line->>'description'
        FROM jsonb_array_elements(p_lines) AS line;
    END IF;
    
    -- 7. Get journal entry number
    SELECT entry_number INTO v_journal_entry_number
    FROM journal_entries_v2
    WHERE id = v_journal_entry_id;
    
    -- 8. Return result
    RETURN QUERY SELECT v_receipt_id, v_receipt_number, v_journal_entry_id, v_journal_entry_number;
END;
$$;

-- ============================================================================
-- CREATE PAYMENT ATOMIC
-- ============================================================================
DROP FUNCTION IF EXISTS create_payment_atomic(DATE, UUID, DECIMAL, TEXT, UUID, JSONB);

CREATE OR REPLACE FUNCTION create_payment_atomic(
    p_date DATE,
    p_treasury_account_id UUID,
    p_amount DECIMAL(15,2),
    p_description TEXT,
    p_supplier_account_id UUID DEFAULT NULL,
    p_lines JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE (
    ret_payment_id UUID,
    ret_payment_number TEXT,
    ret_journal_entry_id UUID,
    ret_journal_entry_number TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_journal_entry_id UUID;
    v_journal_entry_number TEXT;
    v_payment_id UUID;
    v_payment_number TEXT;
    v_journal_lines JSONB;
    v_line JSONB;
BEGIN
    -- 0. Generate payment number
    v_payment_number := 'PAY-' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '-' || substring(uuid_generate_v4()::text from 1 for 4);
    
    -- 1. Validate inputs
    IF p_supplier_account_id IS NULL AND (p_lines IS NULL OR jsonb_array_length(p_lines) = 0) THEN
        RAISE EXCEPTION 'Either supplier_account_id or lines must be provided';
    END IF;
    
    -- 2. Prepare journal lines
    -- Payment: Credit Treasury, Debit Expenses/Liabilities
    
    -- Line 1: Credit Treasury (Cash Out)
    v_journal_lines := jsonb_build_array(
        jsonb_build_object(
            'account_id', p_treasury_account_id,
            'description', p_description,
            'debit', 0,
            'credit', p_amount
        )
    );
    
    -- Line 2+: Debit Expenses/Liabilities
    IF p_supplier_account_id IS NOT NULL THEN
        -- Simple payment to one account
        v_journal_lines := v_journal_lines || jsonb_build_object(
            'account_id', p_supplier_account_id,
            'description', p_description,
            'debit', p_amount,
            'credit', 0
        );
    ELSE
        -- Split payment
        FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
        LOOP
            v_journal_lines := v_journal_lines || jsonb_build_object(
                'account_id', (v_line->>'account_id')::UUID,
                'description', COALESCE(v_line->>'description', p_description),
                'debit', (v_line->>'amount')::DECIMAL,
                'credit', 0
            );
        END LOOP;
    END IF;
    
    -- 3. Create journal entry using RPC (returns only id)
    v_journal_entry_id := create_journal_entry_rpc(
        p_date := p_date,
        p_description := 'Payment: ' || p_description,
        p_reference_type := 'payment',
        p_reference_id := NULL, -- Will update after creating payment
        p_lines := v_journal_lines
    );
    
    -- 4. Create payment record
    INSERT INTO payments_v2 (
        payment_number,
        date,
        treasury_account_id,
        supplier_account_id,
        amount,
        description,
        status,
        journal_entry_id
    ) VALUES (
        v_payment_number,
        p_date,
        p_treasury_account_id,
        p_supplier_account_id,
        p_amount,
        p_description,
        'posted',
        v_journal_entry_id
    ) RETURNING id INTO v_payment_id;
    
    -- 5. Link journal entry to payment
    UPDATE journal_entries_v2
    SET source_id = v_payment_id,
        source_type = 'payment'
    WHERE id = v_journal_entry_id;
    
    -- 6. Insert payment lines
    IF p_supplier_account_id IS NOT NULL THEN
        INSERT INTO payment_lines_v2 (
            payment_id,
            account_id,
            amount,
            description
        ) VALUES (
            v_payment_id,
            p_supplier_account_id,
            p_amount,
            p_description
        );
    ELSE
        -- Insert from lines JSON
        INSERT INTO payment_lines_v2 (
            payment_id,
            account_id,
            amount,
            description
        )
        SELECT 
            v_payment_id,
            (line->>'account_id')::UUID,
            (line->>'amount')::decimal,
            line->>'description'
        FROM jsonb_array_elements(p_lines) AS line;
    END IF;    
    
    -- 7. Get journal entry number
    SELECT entry_number INTO v_journal_entry_number
    FROM journal_entries_v2
    WHERE id = v_journal_entry_id;
    
    -- 8. Return result
    RETURN QUERY SELECT v_payment_id, v_payment_number, v_journal_entry_id, v_journal_entry_number;
END;
$$;

-- ============================================================================
-- DELETE RECEIPT ATOMIC
-- ============================================================================
CREATE OR REPLACE FUNCTION delete_receipt_atomic(
    p_receipt_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_journal_entry_id UUID;
BEGIN
    -- 1. Get journal entry id
    SELECT journal_entry_id INTO v_journal_entry_id
    FROM receipts_v2
    WHERE id = p_receipt_id;
    
    -- 2. Delete receipt lines
    DELETE FROM receipt_lines_v2 WHERE receipt_id = p_receipt_id;
    
    -- 3. Delete receipt
    DELETE FROM receipts_v2 WHERE id = p_receipt_id;
    
    -- 4. Delete journal entry (and lines via cascade if configured, otherwise we should delete lines too)
    -- Assuming foreign keys or triggers handle lines, or we should delete them explicitly
    IF v_journal_entry_id IS NOT NULL THEN
        DELETE FROM journal_entries_v2 WHERE id = v_journal_entry_id;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- ============================================================================
-- DELETE PAYMENT ATOMIC
-- ============================================================================
CREATE OR REPLACE FUNCTION delete_payment_atomic(
    p_payment_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_journal_entry_id UUID;
BEGIN
    -- 1. Get journal entry id
    SELECT journal_entry_id INTO v_journal_entry_id
    FROM payments_v2
    WHERE id = p_payment_id;
    
    -- 2. Delete payment lines
    DELETE FROM payment_lines_v2 WHERE payment_id = p_payment_id;
    
    -- 3. Delete payment
    DELETE FROM payments_v2 WHERE id = p_payment_id;
    
    -- 4. Delete journal entry
    IF v_journal_entry_id IS NOT NULL THEN
        DELETE FROM journal_entries_v2 WHERE id = v_journal_entry_id;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION create_receipt_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION create_payment_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION delete_receipt_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION delete_payment_atomic TO authenticated;
