-- =================================================================
-- CRITICAL FIX: Relax Level Constraint to Allow Customer/Supplier Sub-accounts
-- And Ensure Cash Flow Type Support
-- =================================================================

-- 1. Update the Account Creation RPC
CREATE OR REPLACE FUNCTION create_hierarchical_account_rpc(
    p_name_ar TEXT,
    p_name_en TEXT,
    p_parent_id TEXT,
    p_description TEXT DEFAULT NULL,
    p_currency TEXT DEFAULT 'LYD',
    p_cash_flow_type TEXT DEFAULT NULL -- classification for cash flow statement
)
RETURNS TEXT AS $func$
DECLARE
    v_parent_record RECORD;
    v_new_code TEXT;
    v_new_id TEXT;
BEGIN
    -- 1. Validate Parent
    SELECT * INTO v_parent_record FROM accounts WHERE id = p_parent_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent account not found';
    END IF;

    -- FIX: Increase max level depth to 6 to allow sub-accounts under "Customers" (Level 4)
    IF v_parent_record.level >= 6 THEN
        RAISE EXCEPTION 'Cannot create sub-accounts for Level 6 accounts (Max Depth Reached)';
    END IF;

    -- 2. Generate Code
    v_new_code := generate_account_code(p_parent_id);

    -- 3. Insert
    INSERT INTO accounts (
        name_ar,
        name_en,
        account_code,
        parent_id,
        account_type_id,
        level,
        is_parent,
        is_active,
        currency,
        description,
        cash_flow_type,
        created_at,
        updated_at
    ) VALUES (
        p_name_ar,
        p_name_en,
        v_new_code,
        p_parent_id,
        v_parent_record.account_type_id,
        v_parent_record.level + 1,
        FALSE, -- Defaults to false, logic elsewhere can mark as parent if needed
        TRUE,
        COALESCE(p_currency, v_parent_record.currency, 'LYD'),
        p_description,
        p_cash_flow_type,
        NOW(),
        NOW()
    ) RETURNING id INTO v_new_id;

    -- 4. Mark parent as is_parent if not already
    UPDATE accounts SET is_parent = TRUE WHERE id = p_parent_id AND is_parent = FALSE;

    RETURN v_new_id;
END;
$func$ LANGUAGE plpgsql;

-- 2. Ensure Schema Column Exists (Idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='cash_flow_type') THEN
        ALTER TABLE accounts ADD COLUMN cash_flow_type TEXT CHECK (cash_flow_type IN ('operating', 'investing', 'financing'));
    END IF;
END $$;
