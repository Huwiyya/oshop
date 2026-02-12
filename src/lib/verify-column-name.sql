DO $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'purchase_invoices' 
        AND column_name = 'supplier_account_id'
    ) INTO v_exists;

    IF v_exists THEN
        RAISE NOTICE 'Column supplier_account_id EXISTS in purchase_invoices';
    ELSE
        RAISE NOTICE 'Column supplier_account_id DOES NOT EXIST in purchase_invoices';
    END IF;
END $$;
