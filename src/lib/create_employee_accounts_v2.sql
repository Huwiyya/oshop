
DO $$
DECLARE
    v_liability_type_id UUID;
    v_emp_payable_id UUID;
BEGIN
    -- 1. Get Liability Type ID
    SELECT id INTO v_liability_type_id FROM account_types_v2 WHERE name_en = 'Liabilities' OR category = 'liability' LIMIT 1;
    
    IF v_liability_type_id IS NULL THEN
        RAISE EXCEPTION 'Liability account type not found in account_types_v2';
    END IF;

    -- 2. Create Employees Payable Control Account (2130)
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, current_balance)
    VALUES ('2130', 'مستحقات الموظفين', 'Employees Payable', v_liability_type_id, 3, true, 0)
    ON CONFLICT (code) DO NOTHING
    RETURNING id INTO v_emp_payable_id;

    RAISE NOTICE 'Employees Payable V2 account ensured (2130)';

END $$;
