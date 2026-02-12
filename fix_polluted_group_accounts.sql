-- Fix Polluted Group Accounts (Accounts that are Groups but have Journal Lines)
DO $$
DECLARE
    r RECORD;
    v_child_id UUID;
    v_child_code TEXT;
    v_parent_currency TEXT;
    v_parent_type UUID;
    v_parent_level INT;
BEGIN
    FOR r IN 
        SELECT DISTINCT a.id, a.code, a.name_ar 
        FROM accounts_v2 a
        JOIN journal_lines_v2 jl ON a.id = jl.account_id
        WHERE a.is_group = true
    LOOP
        -- Generate child code (e.g., 1111 -> 111199, 1 -> 199, 1131 -> 113199)
        -- Adjusting for "1" -> "199" might overlap if not careful, but 99 suffix is usually safe for "Others"
        v_child_code := r.code || '99';
        
        -- Get parent details for inheritance
        SELECT currency, type_id, level INTO v_parent_currency, v_parent_type, v_parent_level FROM accounts_v2 WHERE id = r.id;
        
        -- Check if child exists, else create it
        SELECT id INTO v_child_id FROM accounts_v2 WHERE code = v_child_code;
        
        IF v_child_id IS NULL THEN
            INSERT INTO accounts_v2 (
                name_ar, 
                name_en, 
                code, 
                parent_id, 
                type_id, 
                level, 
                is_group, 
                is_active, 
                current_balance, 
                currency,
                created_at,
                updated_at
            ) VALUES (
                r.name_ar || ' - تسوية (غير مصنف)', 
                'Adjustment (Unallocated)', 
                v_child_code, 
                r.id, -- Parent is the group itself
                v_parent_type, 
                v_parent_level + 1, 
                false, 
                true, 
                0, 
                v_parent_currency,
                NOW(),
                NOW()
            )
            RETURNING id INTO v_child_id;
            
            RAISE NOTICE 'Created adjustment account % for group %', v_child_code, r.code;
        END IF;
        
        -- Move journal lines
        UPDATE journal_lines_v2 SET account_id = v_child_id WHERE account_id = r.id;
        
        -- Reset Group Balance to 0 (It should calculate from children now)
        UPDATE accounts_v2 SET current_balance = 0 WHERE id = r.id;
        
        -- Update Child Balance
        UPDATE accounts_v2 
        SET current_balance = (
            SELECT COALESCE(SUM(
                CASE 
                    WHEN at.normal_balance = 'debit' THEN jl.debit - jl.credit 
                    ELSE jl.credit - jl.debit 
                END
            ), 0)
            FROM journal_lines_v2 jl
            JOIN accounts_v2 a ON jl.account_id = a.id
            JOIN account_types_v2 at ON a.type_id = at.id
            WHERE jl.account_id = v_child_id
        )
        WHERE id = v_child_id;
        
    END LOOP;
END $$;
