-- ============================================
-- FIX V3: Safe Trigger Cleanup using System Catalog
-- ============================================

-- This script queries the low-level pg_trigger catalog to find ONLY user-defined triggers.
-- It avoids dropping internal constraint triggers (Foreign Keys, etc).

DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    -- Loop through all USER DEFINED triggers on these tables
    FOR r IN 
        SELECT tgname, relname
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE c.relname IN ('receipt_lines', 'payment_lines', 'sales_invoice_lines', 'purchase_invoice_lines')
        AND t.tgisinternal = FALSE -- critical: ignore internal/system triggers
    LOOP
        -- Drop the user trigger
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.tgname) || ' ON ' || quote_ident(r.relname);
        RAISE NOTICE 'Dropped trigger: % on table %', r.tgname, r.relname;
    END LOOP; 
END $$;
