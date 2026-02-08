-- Force Fix for Purchase Invoice RPC (v3 - Final)
-- Goal: Fix schema mismatches in purchase_invoices table.
-- Fixes:
-- 1. Use 'supplier_account_id' instead of 'supplier_id'.
-- 2. Generate 'invoice_number' (NOT NULL column).
-- 3. Use 'payment_status' instead of 'status'.
-- 4. Handle ID as TEXT (both for invoice and linked journal entry).
-- 5. Link Journal Entry ID to invoice after creation.

BEGIN;

-- 1. Ensure Level 4 General Inventory Account (113001) Exists (Same as before)
DO $$
DECLARE
    v_parent_id TEXT;
    v_account_type_id TEXT;
BEGIN
    SELECT id::TEXT INTO v_parent_id FROM accounts WHERE account_code = '1130';
    
    IF v_parent_id IS NOT NULL THEN
        SELECT account_type_id::TEXT INTO v_account_type_id FROM accounts WHERE id::TEXT = v_parent_id;

        IF NOT EXISTS (SELECT 1 FROM accounts WHERE account_code = '113001') THEN
            INSERT INTO accounts (
                id, account_code, name_ar, name_en, parent_id, level, is_parent, is_active, account_type_id, currency, created_at, updated_at
            ) VALUES (
                uuid_generate_v4(), 
                '113001', 
                'مخزون عام', 
                'General Inventory', 
                v_parent_id::UUID, -- Assuming parent_id is UUID in DB, cast to UUID
                4, 
                false, 
                true, 
                v_account_type_id::UUID, 
                'LYD', 
                NOW(), 
                NOW()
            );
            RAISE NOTICE 'Created Level 4 Inventory Account: 113001';
        ELSE
            RAISE NOTICE 'Level 4 Inventory Account 113001 already exists.';
        END IF;
    ELSE
        RAISE WARNING 'Parent Account 1130 not found! Please check Chart of Accounts.';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in DO block: %', SQLERRM;
END $$;

-- 2. Redefine create_purchase_invoice_rpc
DROP FUNCTION IF EXISTS create_purchase_invoice_rpc(UUID, DATE, JSONB, TEXT, NUMERIC, TEXT, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS create_purchase_invoice_rpc(UUID, DATE, JSONB, TEXT, NUMERIC, TEXT, TEXT, UUID, NUMERIC);

CREATE OR REPLACE FUNCTION create_purchase_invoice_rpc(
    p_supplier_id UUID,
    p_date DATE,
    p_items JSONB,
    p_currency TEXT,
    p_exchange_rate NUMERIC,
    p_notes TEXT,
    p_payment_method TEXT,
    p_payment_account_id UUID DEFAULT NULL,
    p_paid_amount NUMERIC DEFAULT 0
) RETURNS TEXT AS $$ -- Changed return type to TEXT to match table ID
DECLARE
    v_invoice_id TEXT;
    v_invoice_number TEXT;
    v_total_amount NUMERIC := 0;
    v_item JSONB;
    v_inventory_account_id UUID;
    v_cash_account_id UUID;
    v_journal_id TEXT;
begin
    -- A. Get Valid Level 4 Inventory Account
    SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '113001';
    
    IF v_inventory_account_id IS NULL THEN
        SELECT id INTO v_inventory_account_id 
        FROM accounts 
        WHERE account_code LIKE '1130%' AND level = 4 
        ORDER BY account_code ASC 
        LIMIT 1;
    END IF;

    IF v_inventory_account_id IS NULL THEN
        RAISE EXCEPTION 'No Level 4 Inventory Account found (searched for 113001 or children of 1130).';
    END IF;

    -- B. Calculate Total
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_total_amount := v_total_amount + (COALESCE((v_item->>'quantity')::NUMERIC, 0) * COALESCE((v_item->>'unitPrice')::NUMERIC, 0));
    END LOOP;

    -- C. Generate Invoice Number (Simple format: PI-YYYYMMDD-RANDOM)
    v_invoice_number := 'PI-' || to_char(p_date, 'YYYYMMDD') || '-' || substring(uuid_generate_v4()::text from 1 for 5);

    -- D. Insert Invoice
    INSERT INTO purchase_invoices (
        supplier_account_id, 
        invoice_date, 
        invoice_number, 
        total_amount, 
        currency, 
        exchange_rate, 
        payment_status, -- Correct column name
        notes, 
        created_at
    )
    VALUES (
        p_supplier_id::TEXT, 
        p_date, 
        v_invoice_number,
        v_total_amount, 
        p_currency, 
        p_exchange_rate, 
        CASE WHEN p_paid_amount >= v_total_amount THEN 'paid' ELSE 'unpaid' END,
        p_notes, 
        NOW()
    )
    RETURNING id INTO v_invoice_id;

    -- E. Create Journal Entry (Purchase)
    -- This function returns TEXT ID
    v_journal_id := create_journal_entry_rpc(
        p_date,
        'فاتورة شراء رقم: ' || v_invoice_number || ' - ' || p_notes,
        'purchase_invoice',
        v_invoice_id,
        jsonb_build_array(
            -- Debit: Inventory (113001)
            jsonb_build_object('accountId', v_inventory_account_id, 'debit', v_total_amount, 'credit', 0),
            -- Credit: Supplier
            jsonb_build_object('accountId', p_supplier_id, 'debit', 0, 'credit', v_total_amount)
        ),
        false -- is_hidden
    );
    
    -- F. Link Journal Entry to Invoice
    UPDATE purchase_invoices 
    SET journal_entry_id = v_journal_id 
    WHERE id = v_invoice_id;

    -- G. Handle Payment
    IF p_paid_amount > 0 THEN
        v_cash_account_id := p_payment_account_id;
        
        IF v_cash_account_id IS NULL THEN
             SELECT id INTO v_cash_account_id FROM accounts WHERE account_code LIKE '111%' AND level = 4 LIMIT 1;
        END IF;

        IF v_cash_account_id IS NOT NULL THEN
            PERFORM create_journal_entry_rpc(
                p_date,
                'سداد فاتورة شراء رقم: ' || v_invoice_number,
                'payment',
                v_invoice_id,
                jsonb_build_array(
                    -- Debit: Supplier (reducing liability)
                    jsonb_build_object('accountId', p_supplier_id, 'debit', p_paid_amount, 'credit', 0),
                    -- Credit: Cash/Bank
                    jsonb_build_object('accountId', v_cash_account_id, 'debit', 0, 'credit', p_paid_amount)
                ),
                false
            );
        END IF;
    END IF;

    RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;
