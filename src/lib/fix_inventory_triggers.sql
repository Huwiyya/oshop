-- =============================================================================
-- FIX INVENTORY TRIGGERS (UPDATED WITH COST CALCULATION)
-- =============================================================================
-- Purpose: Re-create the inventory trigger functions and triggers to ensure
-- that 'posted' invoices (Purchases & Sales) correctly update inventory.

BEGIN;

-- 1. PROCESS PURCHASE INVENTORY (Stock In)
CREATE OR REPLACE FUNCTION public.process_purchase_inventory_v2()
RETURNS TRIGGER AS $$
DECLARE
    v_line RECORD;
BEGIN
    -- Only process if status changed to 'posted'
    -- We add a check for OLD is null to handle direct inserts as posted (though we should use update)
    IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
        
        -- Iterate Lines
        FOR v_line IN SELECT * FROM public.purchase_invoice_lines_v2 WHERE invoice_id = NEW.id LOOP
            IF v_line.product_id IS NOT NULL THEN
                -- 1. Create Layer
                INSERT INTO public.inventory_layers_v2 (
                    product_id, date, quantity, remaining_quantity, unit_cost, source_type, source_id
                ) VALUES (
                    v_line.product_id, NEW.date, v_line.quantity, v_line.quantity, v_line.unit_price, 'purchase_invoice', NEW.id
                );
                
                -- 2. Create Transaction
                INSERT INTO public.inventory_transactions_v2 (
                    product_id, date, transaction_type, quantity, unit_cost, source_type, source_id
                ) VALUES (
                    v_line.product_id, NEW.date, 'purchase', v_line.quantity, v_line.unit_price, 'purchase_invoice', NEW.id
                );
                
                -- 3. Update Product Qty (and Average Cost if needed, but FIFO handled elsewhere)
                UPDATE public.products_v2 
                SET current_quantity = current_quantity + v_line.quantity
                WHERE id = v_line.product_id;
            END IF;
        END LOOP;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_process_purchase_inventory_v2 ON public.purchase_invoices_v2;
CREATE TRIGGER trg_process_purchase_inventory_v2
    AFTER UPDATE ON public.purchase_invoices_v2
    FOR EACH ROW
    EXECUTE FUNCTION public.process_purchase_inventory_v2();


-- 2. PROCESS SALES INVENTORY (Stock Out & Cost Calculation)
CREATE OR REPLACE FUNCTION public.process_sales_inventory_v2()
RETURNS TRIGGER AS $$
DECLARE
    v_line RECORD;
    v_qty_needed DECIMAL;
    v_layer RECORD;
    v_consume DECIMAL;
    v_total_cogs DECIMAL := 0;
    v_line_cogs DECIMAL;
BEGIN
    -- 1. Handle Stock Deduction (Strictly on Status Change)
    IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
        v_total_cogs := 0;
        
        FOR v_line IN SELECT * FROM public.sales_invoice_lines_v2 WHERE invoice_id = NEW.id LOOP
            IF v_line.product_id IS NOT NULL THEN
                v_qty_needed := v_line.quantity;
                v_line_cogs := 0;
                
                -- Consume Layers (FIFO)
                FOR v_layer IN SELECT * FROM public.inventory_layers_v2 
                               WHERE product_id = v_line.product_id AND remaining_quantity > 0 
                               ORDER BY date ASC, created_at ASC LOOP
                    EXIT WHEN v_qty_needed <= 0;
                    
                    IF v_layer.remaining_quantity >= v_qty_needed THEN
                        v_consume := v_qty_needed;
                    ELSE
                        v_consume := v_layer.remaining_quantity;
                    END IF;
                    
                    UPDATE public.inventory_layers_v2 
                    SET remaining_quantity = remaining_quantity - v_consume 
                    WHERE id = v_layer.id;
                    
                    v_line_cogs := v_line_cogs + (v_consume * v_layer.unit_cost);
                    v_qty_needed := v_qty_needed - v_consume;
                END LOOP;

                -- Accumulate Total COGS
                v_total_cogs := v_total_cogs + v_line_cogs;

                -- Record Transaction (OUT)
                INSERT INTO public.inventory_transactions_v2 (
                    product_id, date, transaction_type, quantity, unit_cost, source_type, source_id
                ) VALUES (
                    v_line.product_id, NEW.date, 'sale', -v_line.quantity, 
                    CASE WHEN v_line.quantity > 0 THEN v_line_cogs / v_line.quantity ELSE 0 END,
                    'sales_invoice', NEW.id 
                );
                
                UPDATE public.products_v2 
                SET current_quantity = current_quantity - v_line.quantity
                WHERE id = v_line.product_id;
            END IF;
        END LOOP;

        -- UPDATE INVOICE TOTAL COST
        UPDATE public.sales_invoices_v2 SET total_cost = v_total_cogs WHERE id = NEW.id;

    END IF;

    -- 2. Handle COGS Journal Lines (Strictly when Journal ID is assigned)
    IF NEW.journal_entry_id IS NOT NULL AND (OLD.journal_entry_id IS NULL OR OLD.journal_entry_id != NEW.journal_entry_id) THEN
        FOR v_line IN SELECT * FROM public.sales_invoice_lines_v2 WHERE invoice_id = NEW.id LOOP
            IF v_line.product_id IS NOT NULL THEN
                
                -- Calculate COGS from transactions or re-calculate?
                -- Better to read from transactions which are accurate record of what happened
                SELECT ABS(SUM(ABS(quantity) * unit_cost)) INTO v_line_cogs 
                FROM public.inventory_transactions_v2 
                WHERE source_id = NEW.id AND source_type = 'sales_invoice' AND product_id = v_line.product_id;
                
                IF v_line_cogs > 0 THEN
                     INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description)
                     SELECT 
                        NEW.journal_entry_id, 
                        p.cogs_account_id, 
                        v_line_cogs, 
                        0, 
                        'Cost of Goods Sold: ' || v_line.product_name
                     FROM public.products_v2 p WHERE p.id = v_line.product_id;

                     INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description)
                     SELECT 
                        NEW.journal_entry_id, 
                        p.inventory_account_id, 
                        0, 
                        v_line_cogs, 
                        'Inventory Decrement: ' || v_line.product_name
                     FROM public.products_v2 p WHERE p.id = v_line.product_id;
                END IF;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_process_sales_inventory_v2 ON public.sales_invoices_v2;
CREATE TRIGGER trg_process_sales_inventory_v2
    AFTER UPDATE ON public.sales_invoices_v2
    FOR EACH ROW
    EXECUTE FUNCTION public.process_sales_inventory_v2();

COMMIT;
