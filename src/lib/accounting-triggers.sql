-- ============================================
-- Accounting Core Logic (Triggers & RPCs)
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. Migration: Increase Decimal Precision to 19,4
ALTER TABLE accounts ALTER COLUMN opening_balance TYPE DECIMAL(19,4);
ALTER TABLE accounts ALTER COLUMN current_balance TYPE DECIMAL(19,4);

ALTER TABLE journal_entries ALTER COLUMN total_debit TYPE DECIMAL(19,4);
ALTER TABLE journal_entries ALTER COLUMN total_credit TYPE DECIMAL(19,4);

ALTER TABLE journal_entry_lines ALTER COLUMN debit TYPE DECIMAL(19,4);
ALTER TABLE journal_entry_lines ALTER COLUMN credit TYPE DECIMAL(19,4);

ALTER TABLE inventory_transactions ALTER COLUMN quantity TYPE DECIMAL(19,4);
ALTER TABLE inventory_transactions ALTER COLUMN unit_cost TYPE DECIMAL(19,4);
ALTER TABLE inventory_transactions ALTER COLUMN total_cost TYPE DECIMAL(19,4);

ALTER TABLE inventory_layers ALTER COLUMN quantity TYPE DECIMAL(19,4);
ALTER TABLE inventory_layers ALTER COLUMN remaining_quantity TYPE DECIMAL(19,4);
ALTER TABLE inventory_layers ALTER COLUMN unit_cost TYPE DECIMAL(19,4);

-- 1. Function: Update Account Balance (Trigger Base)
-- This function runs after every insert/update/delete on journal_entry_lines
CREATE OR REPLACE FUNCTION update_account_balance_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT case
    IF (TG_OP = 'INSERT') THEN
        UPDATE accounts
        SET current_balance = current_balance + (NEW.debit - NEW.credit),
            updated_at = NOW()
        WHERE id = NEW.account_id;
        RETURN NEW;
    
    -- Handle DELETE case
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE accounts
        SET current_balance = current_balance - (OLD.debit - OLD.credit),
            updated_at = NOW()
        WHERE id = OLD.account_id;
        RETURN OLD;

    -- Handle UPDATE case
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Revert OLD change
        UPDATE accounts
        SET current_balance = current_balance - (OLD.debit - OLD.credit)
        WHERE id = OLD.account_id;

        -- Apply NEW change
        UPDATE accounts
        SET current_balance = current_balance + (NEW.debit - NEW.credit),
            updated_at = NOW()
        WHERE id = NEW.account_id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger Definition
DROP TRIGGER IF EXISTS on_journal_entry_line_change ON journal_entry_lines;

CREATE TRIGGER on_journal_entry_line_change
AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
FOR EACH ROW
EXECUTE FUNCTION update_account_balance_trigger();

-- 3. RPC: Create Journal Entry (Atomic Transaction)
-- Returns the ID of the created entry
DROP FUNCTION IF EXISTS create_journal_entry_rpc(date, text, text, text, jsonb);

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
    new_entry_number TEXT; -- Rename to avoid collision if any
    rec JSONB;
    v_total_debit DECIMAL(19,4) := 0; -- Rename variable too
    v_total_credit DECIMAL(19,4) := 0;
    line_debit DECIMAL(19,4);
    line_credit DECIMAL(19,4);
    year_prefix TEXT;
    seq_count INTEGER;
BEGIN
    -- A. Calculate Totals & Verify Balance
    FOR rec IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        line_debit := COALESCE((rec->>'debit')::DECIMAL, 0);
        line_credit := COALESCE((rec->>'credit')::DECIMAL, 0);
        
        v_total_debit := v_total_debit + line_debit;
        v_total_credit := v_total_credit + line_credit;
    END LOOP;

    -- Strict Balance Check (Difference must be 0)
    IF abs(v_total_debit - v_total_credit) > 0.0001 THEN
        RAISE EXCEPTION 'Journal Entry is not balanced! Debit: %, Credit: %', v_total_debit, v_total_credit;
    END IF;

    -- B. Generate Entry Number (JE-YYYY-MMDD-XXXX)
    year_prefix := to_char(p_entry_date, 'YYYYMMDD');
    -- Safe concurrency for MVP: Random suffix or Sequence. 
    -- Ideally use CREATE SEQUENCE. For now, let's use a timestamp based unique ID or random.
    -- Better: Try loop or use a sequence table.
    -- Simplest for now: Add random component.
    new_entry_number := 'JE-' || year_prefix || '-' || floor(random() * 10000)::text;
    
    -- Ensure uniqueness (Retry logic would be better but simple random reduce collision)

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
            journal_entry_id,   -- Use only journal_entry_id (entry_id was removed)
            account_id,
            description,
            debit,
            credit
        ) VALUES (
            new_entry_id,
            rec->>'accountId',
            COALESCE(rec->>'description', p_description),
            COALESCE((rec->>'debit')::DECIMAL, 0),
            COALESCE((rec->>'credit')::DECIMAL, 0)
        );
    END LOOP;

    -- E. Return ID
    RETURN new_entry_id;
END;
$func$ LANGUAGE plpgsql;

-- 4. RPC: Run Depreciation (Atomic)
CREATE OR REPLACE FUNCTION run_depreciation_rpc(
    entry_date DATE,
    description TEXT,
    items JSONB -- Array of { asset_id, depreciation_amount, acc_dep_account_id, exp_account_id }
)
RETURNS JSONB AS $func$
DECLARE
    new_entry_id TEXT;
    total_amount DECIMAL(19,4) := 0;
    rec JSONB;
    lines JSONB := '[]'::JSONB;
BEGIN
    -- 1. Calculate Total & Prepare Lines
    FOR rec IN SELECT * FROM jsonb_array_elements(items)
    LOOP
        total_amount := total_amount + (rec->>'depreciation_amount')::DECIMAL;
        
        -- Debit: Expense
        lines := lines || jsonb_build_object(
            'accountId', rec->>'exp_account_id',
            'description', 'إهلاك - ' || (rec->>'asset_name'),
            'debit', (rec->>'depreciation_amount')::DECIMAL,
            'credit', 0
        );

        -- Credit: Accumulated Depreciation (Contra-Asset)
        lines := lines || jsonb_build_object(
            'accountId', rec->>'acc_dep_account_id',
            'description', 'مجمع إهلاك - ' || (rec->>'asset_name'),
            'debit', 0,
            'credit', (rec->>'depreciation_amount')::DECIMAL
        );

        -- 2. Update Asset Record (Atomically)
        UPDATE fixed_assets
        SET accumulated_depreciation = accumulated_depreciation + (rec->>'depreciation_amount')::DECIMAL,
            net_book_value = net_book_value - (rec->>'depreciation_amount')::DECIMAL,
            last_depreciation_date = entry_date
        WHERE id = (rec->>'asset_id');
    END LOOP;

    -- 3. Create Journal Entry (Using existing RPC logic inside this transaction)
    -- We can call the other function or just do it here. Calling generic RPC is cleaner but requires context.
    -- Let's just call generic create_journal_entry_rpc if possible, or inline it.
    -- Inline is safer for transaction context visibility sometimes, but calling is fine in PG.
    
    SELECT create_journal_entry_rpc(
        entry_date,
        description,
        'depreciation',
        NULL,
        lines
    ) INTO new_entry_id;

    RETURN jsonb_build_object('success', true, 'journal_id', new_entry_id, 'count', jsonb_array_length(items));
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Depreciation Failed: %', SQLERRM;
END;
$func$ LANGUAGE plpgsql;

-- Debug Helper: List Triggers
CREATE OR REPLACE FUNCTION get_table_triggers(p_table_name TEXT)
RETURNS JSONB AS $func$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_agg(jsonb_build_object(
        'trigger_name', tgname,
        'action_statement', 'INTERNAL', -- pg_trigger doesn't store statement easily readable here
        'event_manipulation', tgtype
    ))
    INTO result
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = p_table_name
    AND t.tgisinternal = FALSE;
    
    RETURN COALESCE(result, '[]'::JSONB);
END;
$func$ LANGUAGE plpgsql;
