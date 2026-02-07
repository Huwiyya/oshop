-- ==========================================
-- Fix Inventory Account Level Issue
-- ==========================================
-- Problem: System uses '1130' (Level 3) for transactions, but only Level 4 is allowed.
-- Solution: Create '113001' (General Inventory) and use it as default.

DO $$
DECLARE
    parent_rec RECORD;
    new_id TEXT;
BEGIN
    -- 1. Get Parent Account (1130)
    SELECT * INTO parent_rec FROM accounts WHERE account_code = '1130';
    
    IF parent_rec.id IS NULL THEN
        RAISE NOTICE 'Skipping: Parent account 1130 not found. Please ensure Chart of Accounts is seeded.';
        RETURN;
    END IF;

    -- 2. Check if 113001 exists
    IF NOT EXISTS (SELECT 1 FROM accounts WHERE account_code = '113001') THEN
        RAISE NOTICE 'Creating General Inventory Account (113001)...';
        
        INSERT INTO accounts (
            account_code, 
            name_ar, 
            name_en, 
            parent_id, 
            level, 
            is_parent, 
            is_active, 
            account_type_id, 
            currency,
            created_at,
            updated_at
        ) VALUES (
            '113001', 
            'مخزون عام', 
            'General Inventory', 
            parent_rec.id, 
            4, 
            false, 
            true, 
            parent_rec.account_type_id, 
            'LYD',
            NOW(),
            NOW()
        );
    ELSE
        RAISE NOTICE 'Account 113001 already exists.';
    END IF;
END $$;
