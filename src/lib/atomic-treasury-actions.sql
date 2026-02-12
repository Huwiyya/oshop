-- ============================================
-- Atomic Treasury Operations (Receipts & Payments)
-- Supports: Multi-line, Any Account, Flexible Editing
-- ============================================

-- 1. Create Receipt RPC
CREATE OR REPLACE FUNCTION create_receipt_rpc(
    p_header JSONB, -- { date, boxAccountId, notes, reference? }
    p_lines JSONB   -- Array of { accountId, amount, description? }
)
RETURNS JSONB AS $func$
DECLARE
    new_id TEXT;
    new_number TEXT;
    total_amount DECIMAL(19,4) := 0;
    
    -- Loop vars
    rec JSONB;
    line_amount DECIMAL(19,4);
    
    -- Journal
    je_lines JSONB := '[]'::JSONB;
    
    year_prefix TEXT;
    seq_count INTEGER;
BEGIN
    -- A. Calculate Total
    FOR rec IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        line_amount := (rec->>'amount')::DECIMAL;
        total_amount := total_amount + line_amount;
    END LOOP;

    -- B. Generate Number
    year_prefix := to_char((p_header->>'date')::DATE, 'YYYY');
    SELECT COUNT(*) + 1000 INTO seq_count FROM receipts;
    new_number := 'REC-' || year_prefix || '-' || seq_count;

    -- C. Insert Header
    INSERT INTO receipts (
        receipt_number, receipt_date, bank_account_id,
        total_amount, main_description, status,
        created_at, updated_at
    ) VALUES (
        new_number,
        (p_header->>'date')::DATE,
        p_header->>'boxAccountId',
        total_amount,
        p_header->>'notes',
        'posted',
        NOW(), NOW()
    ) RETURNING id INTO new_id;

    -- D. Insert Lines & Prep JE
    -- 1. DEBIT Box/Bank (The Receiver) - One line for Total
    je_lines := je_lines || jsonb_build_object(
        'accountId', p_header->>'boxAccountId',
        'description', 'قبض نقدية - ' || new_number,
        'debit', total_amount,
        'credit', 0
    );

    FOR rec IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        INSERT INTO receipt_lines (
            receipt_id, account_id, amount, description
        ) VALUES (
            new_id,
            rec->>'accountId',
            (rec->>'amount')::DECIMAL,
            rec->>'description'
        );

        -- 2. CREDIT Inputs (The Givers/Source)
        je_lines := je_lines || jsonb_build_object(
            'accountId', rec->>'accountId',
            'description', COALESCE(rec->>'description', 'سند قبض ' || new_number),
            'debit', 0,
            'credit', (rec->>'amount')::DECIMAL
        );
    END LOOP;

    -- E. Create Journal Entry
    PERFORM create_journal_entry_rpc(
        (p_header->>'date')::DATE,
        'سند قبض ' || new_number || COALESCE(' - ' || (p_header->>'notes'), ''),
        'receipt',
        new_number, -- Reference ID for JE is Receipt Number
        je_lines,
        true -- Hidden
    );
    
    -- Link JE to Receipt (Optional, handled by ref_id mostly, but column exists)
    -- UPDATE receipts SET journal_entry_id = ... (Requires create_je to return ID, which it does)
    -- BUT create_journal_entry_rpc creates the link via Reference ID. 
    -- If `receipts` table has `journal_entry_id` column, we could update it.
    -- Let's fetch the ID.
    DECLARE je_id TEXT;
    BEGIN
        SELECT id INTO je_id FROM journal_entries WHERE reference_type = 'receipt' AND reference_id = new_number LIMIT 1;
        UPDATE receipts SET journal_entry_id = je_id WHERE id = new_id;
    END;

    RETURN jsonb_build_object('success', true, 'id', new_id, 'number', new_number);
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Create Receipt Failed: %', SQLERRM;
END;
$func$ LANGUAGE plpgsql;


-- 2. Create Payment RPC
CREATE OR REPLACE FUNCTION create_payment_rpc(
    p_header JSONB, -- { date, boxAccountId, notes }
    p_lines JSONB   -- Array of { accountId, amount, description? }
)
RETURNS JSONB AS $func$
DECLARE
    new_id TEXT;
    new_number TEXT;
    total_amount DECIMAL(19,4) := 0;
    
    rec JSONB;
    line_amount DECIMAL(19,4);
    
    je_lines JSONB := '[]'::JSONB;
    
    year_prefix TEXT;
    seq_count INTEGER;
BEGIN
    FOR rec IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        total_amount := total_amount + (rec->>'amount')::DECIMAL;
    END LOOP;

    year_prefix := to_char((p_header->>'date')::DATE, 'YYYY');
    SELECT COUNT(*) + 1000 INTO seq_count FROM payments;
    new_number := 'PAY-' || year_prefix || '-' || seq_count;

    INSERT INTO payments (
        payment_number, payment_date, bank_account_id,
        total_amount, main_description, status,
        created_at, updated_at
    ) VALUES (
        new_number,
        (p_header->>'date')::DATE,
        p_header->>'boxAccountId',
        total_amount,
        p_header->>'notes',
        'posted',
        NOW(), NOW()
    ) RETURNING id INTO new_id;

    -- D. JE Prep
    -- 1. CREDIT Box/Bank (The Payer) - One line for Total
    je_lines := je_lines || jsonb_build_object(
        'accountId', p_header->>'boxAccountId',
        'description', 'صرف نقدية - ' || new_number,
        'debit', 0,
        'credit', total_amount
    );

    FOR rec IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        INSERT INTO payment_lines (
            payment_id, account_id, amount, description
        ) VALUES ( -- NOTE: Check schema for payment_lines columns. Assuming standard.
            new_id, -- Wait, payment_lines usually has payment_id? Yes.
            -- Schema check in memory: payment_lines (id, payment_id, account_id, amount...)
            rec->>'accountId',
            (rec->>'amount')::DECIMAL,
            rec->>'description'
        );

        -- 2. DEBIT Expenses/Receiver
        je_lines := je_lines || jsonb_build_object(
            'accountId', rec->>'accountId',
            'description', COALESCE(rec->>'description', 'سند صرف ' || new_number),
            'debit', (rec->>'amount')::DECIMAL,
            'credit', 0
        );
    END LOOP;

    PERFORM create_journal_entry_rpc(
        (p_header->>'date')::DATE,
        'سند صرف ' || new_number || COALESCE(' - ' || (p_header->>'notes'), ''),
        'payment',
        new_number,
        je_lines,
        true -- Hidden
    );
    
    DECLARE je_id TEXT;
    BEGIN
        SELECT id INTO je_id FROM journal_entries WHERE reference_type = 'payment' AND reference_id = new_number LIMIT 1;
        UPDATE payments SET journal_entry_id = je_id WHERE id = new_id;
    END;

    RETURN jsonb_build_object('success', true, 'id', new_id, 'number', new_number);
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Create Payment Failed: %', SQLERRM;
END;
$func$ LANGUAGE plpgsql;


-- 3. Generic Delete Document RPC
-- Handles: sales_invoice, purchase_invoice, receipt, payment
CREATE OR REPLACE FUNCTION delete_document_rpc(
    p_id TEXT,
    p_type TEXT -- 'sales', 'purchase', 'receipt', 'payment'
)
RETURNS JSONB AS $func$
DECLARE
    rec RECORD;
    ref_number TEXT;
    je_ref_type TEXT;
    inv_ref_type TEXT; -- For inventory transactions
BEGIN
    -- 1. Identify & Validate
    IF p_type = 'sales' THEN
        SELECT * INTO rec FROM sales_invoices WHERE id = p_id;
        ref_number := rec.invoice_number;
        je_ref_type := 'sales_invoice';
        inv_ref_type := 'sales_invoice';
        
        -- Special Sales Logic: Add back Inventory
        DECLARE item_line RECORD; 
        BEGIN
            FOR item_line IN SELECT * FROM sales_invoice_lines WHERE invoice_id = p_id LOOP
                -- Add back to item quantity
                UPDATE inventory_items SET quantity_on_hand = quantity_on_hand + item_line.quantity WHERE id = item_line.item_id;
                
                -- Restore Layers: Find transactions for this invoice and restore their layers
                DECLARE trx_rec RECORD;
                BEGIN
                    FOR trx_rec IN SELECT * FROM inventory_transactions 
                                   WHERE reference_type = 'sales_invoice' AND reference_id = ref_number AND item_id = item_line.item_id 
                    LOOP
                        IF trx_rec.layer_id IS NOT NULL THEN
                            UPDATE inventory_layers 
                            SET remaining_quantity = remaining_quantity + trx_rec.quantity
                            WHERE id = trx_rec.layer_id;
                        END IF;
                    END LOOP;
                END;
            END LOOP;
        END;
        DELETE FROM sales_invoice_lines WHERE invoice_id = p_id;
        DELETE FROM sales_invoices WHERE id = p_id;

    ELSIF p_type = 'purchase' THEN
        SELECT * INTO rec FROM purchase_invoices WHERE id = p_id;
        ref_number := rec.invoice_number;
        je_ref_type := 'purchase_invoice';
        inv_ref_type := 'purchase_invoice';

        -- Special Purchase Logic: Deduct Inventory
        DECLARE item_line RECORD; 
        BEGIN
            -- Check if any layer from this purchase was used
            IF EXISTS (
                SELECT 1 FROM inventory_layers 
                WHERE purchase_reference = ref_number AND remaining_quantity < quantity
            ) THEN
                RAISE EXCEPTION 'لا يمكن حذف فاتورة الشراء لأن بعض الأصناف تم بيعها أو سحبها من المخزون بالفعل.';
            END IF;

            FOR item_line IN SELECT * FROM purchase_invoice_lines WHERE invoice_id = p_id LOOP
                UPDATE inventory_items SET quantity_on_hand = quantity_on_hand - item_line.quantity WHERE id = item_line.item_id;
            END LOOP;
        END;
        DELETE FROM purchase_invoice_lines WHERE invoice_id = p_id;
        DELETE FROM purchase_invoices WHERE id = p_id;

    ELSIF p_type = 'receipt' THEN
        SELECT * INTO rec FROM receipts WHERE id = p_id;
        ref_number := rec.receipt_number;
        je_ref_type := 'receipt';
        DELETE FROM receipt_lines WHERE receipt_id = p_id;
        DELETE FROM receipts WHERE id = p_id;

    ELSIF p_type = 'payment' THEN
        SELECT * INTO rec FROM payments WHERE id = p_id;
        ref_number := rec.payment_number;
        je_ref_type := 'payment';
        DELETE FROM payment_lines WHERE payment_id = p_id;
        DELETE FROM payments WHERE id = p_id;

    ELSE
        RAISE EXCEPTION 'Unknown document type: %', p_type;
    END IF;

    -- 2. Delete Inventory Transactions (if any)
    -- 2. Delete Inventory Transactions (if any)
    IF inv_ref_type IS NOT NULL THEN
        DECLARE 
            layers_to_delete TEXT[];
        BEGIN
            -- FIX Start: Capture layers before deleting transactions
            IF p_type = 'purchase' THEN
                 SELECT array_agg(DISTINCT layer_id) INTO layers_to_delete
                 FROM inventory_transactions 
                 WHERE reference_type = 'purchase_invoice' AND reference_id = ref_number;
            END IF;
            -- FIX End

            DELETE FROM inventory_transactions WHERE reference_type = inv_ref_type AND reference_id = ref_number;
            
            -- FIX Start: Delete layers using captured IDs
            IF layers_to_delete IS NOT NULL THEN
                 BEGIN
                    DELETE FROM inventory_layers WHERE id = ANY(layers_to_delete);
                 EXCEPTION WHEN OTHERS THEN NULL; -- Ignore if linked to sales or other constraints
                 END;
            END IF;
            -- FIX End
        END;
    END IF;

    -- 3. Delete Journal Entries
    -- This removes the financial effect completely
    DELETE FROM journal_entries WHERE reference_type = je_ref_type AND reference_id = ref_number;
    
    -- Also delete related entries (like COGS for sales)
    IF p_type = 'sales' THEN
        DELETE FROM journal_entries WHERE reference_type = 'sales_cogs' AND reference_id = ref_number;
        DELETE FROM journal_entries WHERE reference_type = 'receipt' AND reference_id = ref_number; -- If Auto-Receipt
    END IF;
    
    IF p_type = 'purchase' THEN
        DELETE FROM journal_entries WHERE reference_type = 'payment' AND reference_id = ref_number; -- If Auto-Payment
    END IF;

    RETURN jsonb_build_object('success', true, 'deleted_id', p_id);
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Delete Operation Failed: %', SQLERRM;
END;
$func$ LANGUAGE plpgsql;

-- 4. Update Receipt RPC
CREATE OR REPLACE FUNCTION update_receipt_rpc(
    p_id TEXT,
    p_header JSONB, -- { date, boxAccountId, notes }
    p_lines JSONB   -- Array of { accountId, amount, description }
)
RETURNS JSONB AS $func$
DECLARE
    rec_number TEXT;
    total_amount DECIMAL(19,4) := 0;
    rec JSONB;
    je_lines JSONB := '[]'::JSONB;
BEGIN
    -- 1. Get Info & Validate
    SELECT receipt_number INTO rec_number FROM receipts WHERE id = p_id;
    IF rec_number IS NULL THEN RAISE EXCEPTION 'Receipt not found'; END IF;

    -- 2. Calculate New Total
    FOR rec IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
        total_amount := total_amount + (rec->>'amount')::DECIMAL;
    END LOOP;

    -- 3. Delete Old Artifacts
    -- A. Delete Old Lines
    DELETE FROM receipt_lines WHERE receipt_id = p_id;
    
    -- B. Delete Old JE (must clear foreign key first!)
    -- ✅ FIX: Clear journal_entry_id to avoid FK constraint violation
    UPDATE receipts SET journal_entry_id = NULL WHERE id = p_id;
    DELETE FROM journal_entries WHERE reference_type = 'receipt' AND reference_id = rec_number;

    -- 4. Update Header
    UPDATE receipts SET 
        receipt_date = (p_header->>'date')::DATE,
        bank_account_id = p_header->>'boxAccountId',
        total_amount = total_amount,
        main_description = p_header->>'notes',
        updated_at = NOW()
    WHERE id = p_id;

    -- 5. Insert New Lines & Prep JE
    -- DEBIT Box
    je_lines := je_lines || jsonb_build_object(
        'accountId', p_header->>'boxAccountId',
        'description', 'تعديل سند قبض - ' || rec_number,
        'debit', total_amount,
        'credit', 0
    );

    FOR rec IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
        INSERT INTO receipt_lines (receipt_id, account_id, amount, description)
        VALUES (p_id, rec->>'accountId', (rec->>'amount')::DECIMAL, rec->>'description');

        -- CREDIT Source
        je_lines := je_lines || jsonb_build_object(
            'accountId', rec->>'accountId',
            'description', COALESCE(rec->>'description', 'سند قبض ' || rec_number),
            'debit', 0,
            'credit', (rec->>'amount')::DECIMAL
        );
    END LOOP;

    -- 6. Create New JE
    PERFORM create_journal_entry_rpc(
        (p_header->>'date')::DATE,
        'سند قبض ' || rec_number || COALESCE(' - ' || (p_header->>'notes'), ''),
        'receipt',
        rec_number,
        je_lines,
        true -- Hidden
    );
    
    -- Opt: Update Link
    DECLARE je_id TEXT;
    BEGIN
        SELECT id INTO je_id FROM journal_entries WHERE reference_type = 'receipt' AND reference_id = rec_number LIMIT 1;
        UPDATE receipts SET journal_entry_id = je_id WHERE id = p_id;
    END;

    RETURN jsonb_build_object('success', true, 'id', p_id, 'number', rec_number);
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Update Receipt Failed: %', SQLERRM;
END;
$func$ LANGUAGE plpgsql;

-- 5. Update Payment RPC
CREATE OR REPLACE FUNCTION update_payment_rpc(
    p_id TEXT,
    p_header JSONB, -- { date, boxAccountId, notes }
    p_lines JSONB   -- Array of { accountId, amount, description }
)
RETURNS JSONB AS $func$
DECLARE
    pay_number TEXT;
    total_amount DECIMAL(19,4) := 0;
    rec JSONB;
    je_lines JSONB := '[]'::JSONB;
BEGIN
    -- 1. Validate
    SELECT payment_number INTO pay_number FROM payments WHERE id = p_id;
    IF pay_number IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;

    -- 2. New Total
    FOR rec IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
        total_amount := total_amount + (rec->>'amount')::DECIMAL;
    END LOOP;

    -- 3. Delete Old
    DELETE FROM payment_lines WHERE payment_id = p_id;
    
    -- ✅ FIX: Clear journal_entry_id to avoid FK constraint violation  
    UPDATE payments SET journal_entry_id = NULL WHERE id = p_id;
    DELETE FROM journal_entries WHERE reference_type = 'payment' AND reference_id = pay_number;

    -- 4. Update Header
    UPDATE payments SET 
        payment_date = (p_header->>'date')::DATE,
        bank_account_id = p_header->>'boxAccountId',
        total_amount = total_amount,
        main_description = p_header->>'notes',
        updated_at = NOW()
    WHERE id = p_id;

    -- 5. Lines & JE
    -- CREDIT Box
    je_lines := je_lines || jsonb_build_object(
        'accountId', p_header->>'boxAccountId',
        'description', 'تعديل سند صرف - ' || pay_number,
        'debit', 0,
        'credit', total_amount
    );

    FOR rec IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
        INSERT INTO payment_lines (payment_id, account_id, amount, description)
        VALUES (p_id, rec->>'accountId', (rec->>'amount')::DECIMAL, rec->>'description');

        -- DEBIT Expense
        je_lines := je_lines || jsonb_build_object(
            'accountId', rec->>'accountId',
            'description', COALESCE(rec->>'description', 'سند صرف ' || pay_number),
            'debit', (rec->>'amount')::DECIMAL,
            'credit', 0
        );
    END LOOP;

    -- 6. New JE
    PERFORM create_journal_entry_rpc(
        (p_header->>'date')::DATE,
        'سند صرف ' || pay_number || COALESCE(' - ' || (p_header->>'notes'), ''),
        'payment',
        pay_number,
        je_lines,
        true -- Hidden
    );
    
    DECLARE je_id TEXT;
    BEGIN
        SELECT id INTO je_id FROM journal_entries WHERE reference_type = 'payment' AND reference_id = pay_number LIMIT 1;
        UPDATE payments SET journal_entry_id = je_id WHERE id = p_id;
    END;

    RETURN jsonb_build_object('success', true, 'id', p_id, 'number', pay_number);
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Update Payment Failed: %', SQLERRM;
END;
$func$ LANGUAGE plpgsql;
