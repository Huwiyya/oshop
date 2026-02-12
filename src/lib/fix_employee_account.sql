
DO $$
DECLARE
    v_acc_id uuid;
    v_type_id uuid;
    v_system_count int;
BEGIN
    RAISE NOTICE 'Starting Employee Account Fix...';

    -- 1. Find Liability Account Type (legacy)
    SELECT id INTO v_type_id FROM public.account_types WHERE name_en = 'Liabilities' OR normal_balance = 'credit' LIMIT 1;
    
    IF v_type_id IS NULL THEN
        RAISE EXCEPTION 'Could not find Liability account type';
    END IF;
    
    -- 2. Create employees payable account in LEGACY accounts if not exists
    SELECT id INTO v_acc_id FROM public.accounts WHERE name_en = 'Employees Payable' OR account_code = '2130' LIMIT 1;
    
    IF v_acc_id IS NULL THEN
        INSERT INTO public.accounts (name_ar, name_en, account_code, account_type_id, level, is_parent, description)
        VALUES ('مستحقات الموظفين', 'Employees Payable', '2130', v_type_id, 3, true, 'System account for employees')
        RETURNING id INTO v_acc_id;
        RAISE NOTICE 'Created Legacy Employees Payable account: %', v_acc_id;
    ELSE
        RAISE NOTICE 'Legacy Employees Payable account already exists: %', v_acc_id;
    END IF;

    -- 3. Update system_accounts for legacy key AND V2 key (just in case)
    
    -- Legacy Key: EMPLOYEES_PAYABLE
    SELECT count(*) INTO v_system_count FROM public.system_accounts WHERE key = 'EMPLOYEES_PAYABLE';
    IF v_system_count = 0 THEN
        INSERT INTO public.system_accounts (key, account_id) VALUES ('EMPLOYEES_PAYABLE', v_acc_id);
        RAISE NOTICE 'Mapped EMPLOYEES_PAYABLE';
    ELSE
        UPDATE public.system_accounts SET account_id = v_acc_id WHERE key = 'EMPLOYEES_PAYABLE';
        RAISE NOTICE 'Updated EMPLOYEES_PAYABLE';
    END IF;

    -- Also Map EMPLOYEES_CONTROL if missing (sometimes used interchangeably or for V2)
    SELECT count(*) INTO v_system_count FROM public.system_accounts WHERE key = 'EMPLOYEES_CONTROL';
    IF v_system_count = 0 THEN
        INSERT INTO public.system_accounts (key, account_id) VALUES ('EMPLOYEES_CONTROL', v_acc_id);
        RAISE NOTICE 'Mapped EMPLOYEES_CONTROL';
    END IF;

END $$;
