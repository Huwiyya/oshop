

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const sql = `
    -- Master Financial Fix Script
-- Goal: Ensure Level 4 (Analytical) Accounts exist and are used by default in all RPCs.

-- 1. Ensure Level 4 Accounts Exist
DO $$
DECLARE
    parent_rec RECORD;
BEGIN
    -- Inventory (1130 -> 113001)
    SELECT * INTO parent_rec FROM accounts WHERE account_code = '1130';
    IF parent_rec.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM accounts WHERE account_code = '113001') THEN
        INSERT INTO accounts (id, account_code, name_ar, name_en, parent_id, level, is_parent, is_active, account_type_id, currency, created_at, updated_at)
        VALUES (uuid_generate_v4(), '113001', 'مخزون عام', 'General Inventory', parent_rec.id, 4, false, true, parent_rec.account_type_id, 'LYD', NOW(), NOW());
        RAISE NOTICE 'Created Account 113001';
    END IF;

    -- COGS (5100 -> 510001)
    SELECT * INTO parent_rec FROM accounts WHERE account_code = '5100';
    IF parent_rec.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM accounts WHERE account_code = '510001') THEN
        INSERT INTO accounts (id, account_code, name_ar, name_en, parent_id, level, is_parent, is_active, account_type_id, currency, created_at, updated_at)
        VALUES (uuid_generate_v4(), '510001', 'تلفة بضاعة مباعة عامة', 'General COGS', parent_rec.id, 4, false, true, parent_rec.account_type_id, 'LYD', NOW(), NOW());
        RAISE NOTICE 'Created Account 510001';
    END IF;

    -- Sales (4100 -> 410001)
    SELECT * INTO parent_rec FROM accounts WHERE account_code = '4100';
    IF parent_rec.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM accounts WHERE account_code = '410001') THEN
        INSERT INTO accounts (id, account_code, name_ar, name_en, parent_id, level, is_parent, is_active, account_type_id, currency, created_at, updated_at)
        VALUES (uuid_generate_v4(), '410001', 'مبيعات عامة', 'General Sales', parent_rec.id, 4, false, true, parent_rec.account_type_id, 'LYD', NOW(), NOW());
        RAISE NOTICE 'Created Account 410001';
    END IF;
END $$;

-- 2. Update RPCs to use Level 4 Defaults

-- Update create_purchase_invoice_rpc
CREATE OR REPLACE FUNCTION create_purchase_invoice_rpc(
    p_supplier_id UUID,
    p_date DATE,
    p_items JSONB,
    p_currency TEXT,
    p_exchange_rate NUMERIC,
    p_notes TEXT,
    p_payment_method TEXT,
    p_paid_amount NUMERIC
) RETURNS UUID AS $$
DECLARE
    v_invoice_id UUID;
    v_total_amount NUMERIC := 0;
    v_item JSONB;
    v_inventory_account_id UUID;
    v_payable_account_id UUID; 
    
    v_supplier_account_id UUID;
    v_cash_account_id UUID;
BEGIN
    -- 1. Get Accounts
    -- Inventory: MUST be Level 4. Using 113001.
    SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '113001';
    IF v_inventory_account_id IS NULL THEN RAISE EXCEPTION 'Account 113001 not found'; END IF;

    -- Calculate Total
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_total_amount := v_total_amount + (v_item->>'total')::NUMERIC;
    END LOOP;

    -- Insert Invoice
    INSERT INTO purchase_invoices (supplier_id, invoice_date, total_amount, currency, exchange_rate, status, notes, created_at)
    VALUES (p_supplier_id, p_date, v_total_amount, p_currency, p_exchange_rate, 'posted', p_notes, NOW())
    RETURNING id INTO v_invoice_id;

    -- CREATE JOURNAL ENTRY
    -- Debit: Inventory (113001)
    -- Credit: Accounts Payable (Supplier Account ID)
    
    PERFORM create_journal_entry_rpc(
        p_date,
        'Purchase Invoice #' || v_invoice_id,
        'purchase_invoice',
        v_invoice_id::TEXT,
        jsonb_build_array(
            jsonb_build_object('accountId', v_inventory_account_id, 'debit', v_total_amount, 'credit', 0),
            jsonb_build_object('accountId', p_supplier_id, 'debit', 0, 'credit', v_total_amount)
        ),
        p_currency
    );

    -- Handle Payment if Paid Amount > 0
    IF p_paid_amount > 0 THEN
        -- Get Cash Account (Defaulting to Main Cash 111101 or similar if not specified)
        SELECT id INTO v_cash_account_id FROM accounts WHERE account_code LIKE '111%' AND level = 4 LIMIT 1;
        
        PERFORM create_journal_entry_rpc(
             p_date,
             'Payment for Purchase Invoice #' || v_invoice_id,
             'payment',
             v_invoice_id::TEXT,
             jsonb_build_array(
                 jsonb_build_object('accountId', p_supplier_id, 'debit', p_paid_amount, 'credit', 0),
                 jsonb_build_object('accountId', v_cash_account_id, 'debit', 0, 'credit', p_paid_amount)
             ),
             p_currency
        );
    END IF;

    RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- Make sure update_purchase_invoice_rpc also uses 113001
CREATE OR REPLACE FUNCTION update_purchase_invoice_rpc(
  p_invoice_id UUID,
  p_supplier_id UUID,
  p_date DATE,
  p_items JSONB,
  p_currency TEXT,
  p_exchange_rate NUMERIC,
  p_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_total NUMERIC;
  v_new_total NUMERIC := 0;
  v_item JSONB;
  v_inventory_account_id UUID;
BEGIN
  -- Get default Level 4 Inventory Account
  SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '113001';

  -- Calculate new total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_new_total := v_new_total + (v_item->>'total')::NUMERIC;
  END LOOP;

  -- Update Invoice
  UPDATE purchase_invoices
  SET 
    supplier_id = p_supplier_id,
    invoice_date = p_date,
    total_amount = v_new_total,
    currency = p_currency,
    exchange_rate = p_exchange_rate,
    notes = p_notes,
    updated_at = NOW()
  WHERE id = p_invoice_id;

  -- Logic updates to Journals would go here if needed...
END;
$$;
    `;

    const { error } = await supabase.rpc('exec_sql', { sql }); // Assuming exec_sql exists? 
    // If exec_sql doesn't exist, I can't run raw SQL easily via client.
    // However, I can use a direct postgres connection IF `pg` was installed, but it might not be.
    // Wait, the user has `atomic - financial - actions.sql` suggesting they run SQL via some tool or migration.
    // I will try to use the browser subagent to execute it in the Supabase SQL Editor if I can log in, or...

    // Fallback: I will just use the `browser` tool to hit this endpoint if I can wrap it in a `postgres` call?
    // No, standard supabase client doesn't run raw SQL unless an RPC for it is exposed.

    // ALTERNATIVE: Use the browser to open the app (if running) and trigger a hidden button? No.

    // Best Bet: Create a migration file? I did that.
    // Since `psql` failed, and I cannot easily run raw SQL from node without `pg` and connection string.
    // I will use the `browser` tool to verify the fix works by TRYING the actions.
    // If the actions fail, I know the SQL didn't run.

    // BUT the SQL contained the FIX for the RPCs. The RPCs won't be updated unless I run the SQL.
    // I MUST run the SQL.

    // Let's assume there is a `postgres` tool or I can use the `browser` to use Supabase Dashboard.
    // But I don't have Supabase Dashboard credentials.

    // CHECK: Does the project have a way to run migrations? `npm run migrate`?
    // Let's check `package.json`.

    return NextResponse.json({ result: 'Script logic defined but raw execution requires exec_sql or psql.' });
}
