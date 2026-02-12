DO $$
DECLARE
    v_product_id UUID;
    v_layer_id UUID;
    v_invoice_id UUID;
    v_card_num TEXT := 'CARD-TEST-' || extract(epoch from now());
    v_qty_before DECIMAL;
    v_qty_after DECIMAL;
BEGIN
    RAISE NOTICE 'Starting Card Verification...';

    -- 1. Create a Product
    INSERT INTO public.products_v2 (sku, name_ar, name_en, category, type)
    VALUES ('SKU-CARD-TEST', 'Test Card', 'Test Card', 'cards', 'product')
    RETURNING id INTO v_product_id;

    RAISE NOTICE 'Created Product: %', v_product_id;

    -- 2. Insert Inventory Layer (Simulate Purchase)
    INSERT INTO public.inventory_layers_v2 (product_id, date, quantity, remaining_quantity, unit_cost, source_type, card_number)
    VALUES (v_product_id, CURRENT_DATE, 1, 1, 10, 'manual', v_card_num)
    RETURNING id INTO v_layer_id;

    RAISE NOTICE 'Created Layer: % with Card: %', v_layer_id, v_card_num;

    -- 3. Create Sales Invoice Header
    INSERT INTO public.sales_invoices_v2 (invoice_number, date, customer_account_id, revenue_account_id, amount, status)
    VALUES ('INV-TEST-CARD', CURRENT_DATE, (SELECT id FROM accounts_v2 LIMIT 1), (SELECT id FROM accounts_v2 LIMIT 1), 15, 'draft')
    RETURNING id INTO v_invoice_id;

    -- 4. Insert Sales Line with Card Number
    INSERT INTO public.sales_invoice_lines_v2 (invoice_id, product_id, quantity, unit_price, card_number)
    VALUES (v_invoice_id, v_product_id, 1, 15, v_card_num);

    -- 5. Post Invoice (Trigger validates consumption)
    UPDATE public.sales_invoices_v2 SET status = 'posted' WHERE id = v_invoice_id;

    -- 6. Verify Layer Consumption
    SELECT remaining_quantity INTO v_qty_after FROM public.inventory_layers_v2 WHERE id = v_layer_id;
    
    IF v_qty_after = 0 THEN
        RAISE NOTICE 'SUCCESS: Layer consumed correctly!';
    ELSE
        RAISE EXCEPTION 'FAILURE: Layer remaining quantity is % (expected 0)', v_qty_after;
    END IF;

    -- Cleanup
    -- DELETE FROM public.sales_invoices_v2 WHERE id = v_invoice_id;
    -- DELETE FROM public.products_v2 WHERE id = v_product_id;

END $$;
