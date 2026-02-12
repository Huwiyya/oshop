-- ============================================
-- 4-Level Hierarchical CoA Logic
-- ============================================

-- A. Automated Coding Function
CREATE OR REPLACE FUNCTION generate_account_code(p_parent_id TEXT)
RETURNS TEXT AS $func$
DECLARE
    v_parent_code TEXT;
    v_parent_level INTEGER;
    v_new_level INTEGER;
    v_last_code TEXT;
    v_next_seq INTEGER;
    v_padding INTEGER;
BEGIN
    -- 1. Get Parent Info
    SELECT account_code, level INTO v_parent_code, v_parent_level 
    FROM accounts WHERE id = p_parent_id;

    IF v_parent_code IS NULL THEN
        RAISE EXCEPTION 'Parent account not found';
    END IF;

    v_new_level := v_parent_level + 1;

    -- 2. Determine Padding
    -- Levels 2 and 3 append 1 digit (e.g., 1 -> 11, 11 -> 111)
    -- Level 4 appends 3 digits (e.g., 111 -> 111001)
    IF v_new_level <= 3 THEN
        v_padding := 1;
    ELSE
        v_padding := 3;
    END IF;

    -- 3. Find Last Child Code
    SELECT account_code INTO v_last_code
    FROM accounts
    WHERE parent_id = p_parent_id
    ORDER BY account_code DESC
    LIMIT 1;

    -- 4. Calculate Next Sequence
    IF v_last_code IS NOT NULL THEN
        -- Extract suffix and increment
        v_next_seq := (substring(v_last_code from length(v_parent_code) + 1))::INTEGER + 1;
    ELSE
        v_next_seq := 1;
    END IF;

    -- 5. Return Formatted Code
    RETURN v_parent_code || LPAD(v_next_seq::TEXT, v_padding, '0');
END;
$func$ LANGUAGE plpgsql;

-- B. Account Creation RPC
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

    IF v_parent_record.level >= 4 THEN
        RAISE EXCEPTION 'Cannot create sub-accounts for Level 4 (Analytical) accounts';
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

-- C. Transaction Level Constraint
-- Ensure journal entries only hit Level 4 accounts
CREATE OR REPLACE FUNCTION validate_transaction_level_trigger()
RETURNS TRIGGER AS $func$
DECLARE
    v_level INTEGER;
BEGIN
    SELECT level INTO v_level FROM accounts WHERE id = NEW.account_id;
    
    IF v_level IS NULL OR v_level < 4 THEN
        RAISE EXCEPTION 'Transactions are only allowed on Level 4 (Analytical) accounts. Account % is Level %', 
            (SELECT account_code FROM accounts WHERE id = NEW.account_id), v_level;
    END IF;
    
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_transaction_level ON journal_entry_lines;
CREATE TRIGGER trg_validate_transaction_level
BEFORE INSERT OR UPDATE ON journal_entry_lines
FOR EACH ROW
EXECUTE FUNCTION validate_transaction_level_trigger();
