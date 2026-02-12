-- =============================================================================
-- VERIFY BACKEND LOGIC (Standalone Test)
-- =============================================================================
-- Execute this script to simulate the Invoice Creation Flow entirely within SQL.

BEGIN;

DO $$
DECLARE
    v_supplier_id UUID;
    v_inventory_id UUID;
    v_product_id UUID;
    v_invoice_id UUID;
    v_invoice_num TEXT := 'TEST-SQL-' || extract(epoch from now());
    v_stock_before DECIMAL;
    v_stock_after DECIMAL;
    v_layer_count INTEGER;
    v_trans_count INTEGER;
BEGIN
    RAISE NOTICE '🚀 STARTING SQL VERIFICATION...';

    -- 1. Setup Data
    -- Ensure Account Types Exist
    INSERT INTO account_types_v2 (name_en, name_ar, category, normal_balance)
    VALUES 
        ('Current Assets', 'أصول متداولة', 'asset', 'debit'), 
        ('Current Liabilities', 'خصوم متداولة', 'liability', 'credit')
    ON CONFLICT (name_en) DO NOTHING;

    -- Create/Find Inventory Account
    SELECT id INTO v_inventory_id FROM accounts_v2 WHERE name_en = 'Inventory Verification';
    IF v_inventory_id IS NULL THEN
        INSERT INTO accounts_v2 (code, name_en, name_ar, type_id, level, is_group)
        VALUES (
            '1000-VERIFY', 
            'Inventory Verification', 
            'مخزون التحقق', 
            (SELECT id FROM account_types_v2 WHERE category = 'asset' LIMIT 1),
            1,
            false
        ) RETURNING id INTO v_inventory_id;
    END IF;

    -- Create/Find Supplier Account
    SELECT id INTO v_supplier_id FROM accounts_v2 WHERE name_en = 'Supplier Verification';
    IF v_supplier_id IS NULL THEN
        INSERT INTO accounts_v2 (code, name_en, name_ar, type_id, level, is_group)
        VALUES (
            '2000-VERIFY', 
            'Supplier Verification', 
            'مورد التحقق', 
            (SELECT id FROM account_types_v2 WHERE category = 'liability' LIMIT 1),
            1,
            false
        ) RETURNING id INTO v_supplier_id;
    END IF;

    RAISE NOTICE '✅ Accounts Setup: Inv=%, Supp=%', v_inventory_id, v_supplier_id;
    
    -- Create Test Product
    INSERT INTO products_v2 (name_ar, name_en, sku, inventory_account_id, current_quantity)
    VALUES ('منتج SQL', 'SQL Product', 'SQL-' || extract(epoch from now()), v_inventory_id, 0)
    RETURNING id INTO v_product_id;
    
    RAISE NOTICE '✅ Created Test Product: %', v_product_id;

    -- 2. Create Invoice Header (DRAFT)
    INSERT INTO purchase_invoices_v2 (
        invoice_number, date, supplier_account_id, expense_account_id, amount, status
    ) VALUES (
        v_invoice_num, CURRENT_DATE, v_supplier_id, v_inventory_id, 100, 'draft'
    ) RETURNING id INTO v_invoice_id;

    RAISE NOTICE '✅ Created Draft Invoice: %', v_invoice_id;

    -- 3. Create Invoice Line
    INSERT INTO purchase_invoice_lines_v2 (
        invoice_id, product_id, description, quantity, unit_price
    ) VALUES (
        v_invoice_id, v_product_id, 'SQL Test Item', 10, 10
    );

    RAISE NOTICE '✅ Created Invoice Line';

    -- Check Stock Before Post
    SELECT current_quantity INTO v_stock_before FROM products_v2 WHERE id = v_product_id;
    RAISE NOTICE '📊 Stock Before Post: % (Expected 0)', v_stock_before;

    -- 4. UPDATE STATUS TO POSTED (This should trigger the logic)
    UPDATE purchase_invoices_v2 SET status = 'posted' WHERE id = v_invoice_id;
    
    RAISE NOTICE '🔄 Updated Invoice to POSTED';

    -- 5. Verify Results
    SELECT current_quantity INTO v_stock_after FROM products_v2 WHERE id = v_product_id;
    SELECT count(*) INTO v_layer_count FROM inventory_layers_v2 WHERE source_id = v_invoice_id;
    SELECT count(*) INTO v_trans_count FROM inventory_transactions_v2 WHERE source_id = v_invoice_id;

    RAISE NOTICE '📊 Stock After Post: %', v_stock_after;
    RAISE NOTICE '📝 Layers Created: %', v_layer_count;
    RAISE NOTICE '📝 Transactions Created: %', v_trans_count;

    IF v_stock_after = 10 AND v_layer_count = 1 AND v_trans_count = 1 THEN
        RAISE NOTICE '🎉 VERIFICATION SUCCESSFUL!';
    ELSE
        RAISE EXCEPTION '❌ VERIFICATION FAILED! Stock: %, Layers: %, Trans: %', v_stock_after, v_layer_count, v_trans_count;
    END IF;

    -- Clean up test data (Optional, or rely on transaction rollback if run manually)
    -- We'll leave it to inspect unless wrapped in a transaction that is rolled back.
    -- Since we use 'DO' block, it runs in a transaction. We can create error to rollback or just commit.
    -- We want to commit if successful so we can see data.
    
END $$;

COMMIT;
