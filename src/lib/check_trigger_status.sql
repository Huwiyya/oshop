-- =============================================================================
-- DIAGNOSE TRIGGER STATUS
-- =============================================================================

-- 1. Check if triggers exist and are enabled
SELECT 
    tgname AS trigger_name,
    relname AS table_name,
    tgenabled AS status -- 'O' = origin, 'D' = disabled, 'R' = replica, 'A' = always
FROM pg_trigger
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
WHERE tgname IN ('trg_process_purchase_inventory_v2', 'trg_process_sales_inventory_v2');

-- 2. Check if the function exists
SELECT routines.routine_name, routines.data_type
FROM information_schema.routines
WHERE routines.specific_schema = 'public'
  AND routines.routine_name IN ('process_purchase_inventory_v2', 'process_sales_inventory_v2');

-- 3. Check for any recent errors in postgres logs (not directly possible via SQL query usually, but good to know)

-- 4. FORCE Run the logic manually for the failed invoice (to see if logic itself errors)
do $$
DECLARE
    v_invoice_id UUID := '7e5c8e13-b30d-4be5-923e-5d3935cb42cd'; -- From failed logs
    v_line RECORD;
BEGIN
    -- Log start
    RAISE NOTICE 'Starting Manual Trigger Logic Test for Invoice %', v_invoice_id;

    FOR v_line IN SELECT * FROM public.purchase_invoice_lines_v2 WHERE invoice_id = v_invoice_id LOOP
        RAISE NOTICE 'Processing Line Item: %', v_line.id;
        
        -- Try Insert Layer
        INSERT INTO public.inventory_layers_v2 (
            product_id, date, quantity, remaining_quantity, unit_cost, source_type, source_id
        ) VALUES (
            v_line.product_id, CURRENT_DATE, v_line.quantity, v_line.quantity, v_line.unit_price, 'purchase_invoice', v_invoice_id
        );
        RAISE NOTICE 'Layer Created';
        
        -- Try Insert Transaction
        INSERT INTO public.inventory_transactions_v2 (
            product_id, date, transaction_type, quantity, unit_cost, source_type, source_id
        ) VALUES (
            v_line.product_id, CURRENT_DATE, 'purchase', v_line.quantity, v_line.unit_price, 'purchase_invoice', v_invoice_id
        );
        RAISE NOTICE 'Transaction Created';

        -- Try Update Product
        UPDATE public.products_v2 
        SET current_quantity = current_quantity + v_line.quantity
        WHERE id = v_line.product_id;
        RAISE NOTICE 'Product Updated';
    END LOOP;
END $$;
