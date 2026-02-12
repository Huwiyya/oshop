CREATE OR REPLACE FUNCTION public.process_purchase_inventory_v2() RETURNS TRIGGER AS $$
DECLARE
    v_line RECORD;
    v_product RECORD;
    v_new_quantity DECIMAL;
    v_new_avg_cost DECIMAL;
    v_old_total_value DECIMAL;
    v_new_total_value DECIMAL;
BEGIN
    IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
        FOR v_line IN SELECT * FROM public.purchase_invoice_lines_v2 WHERE invoice_id = NEW.id LOOP
            IF v_line.product_id IS NOT NULL THEN
                -- 1. Insert Layer
                INSERT INTO public.inventory_layers_v2 (product_id, date, quantity, remaining_quantity, unit_cost, source_type, source_id, card_number)
                VALUES (v_line.product_id, NEW.date, v_line.quantity, v_line.quantity, v_line.unit_price, 'purchase_invoice', NEW.id, v_line.card_number);

                -- 2. Insert Transaction
                INSERT INTO public.inventory_transactions_v2 (product_id, date, transaction_type, quantity, unit_cost, source_type, source_id)
                VALUES (v_line.product_id, NEW.date, 'purchase', v_line.quantity, v_line.unit_price, 'purchase_invoice', NEW.id);

                -- 3. Update Product (Quantity AND Average Cost)
                SELECT * INTO v_product FROM public.products_v2 WHERE id = v_line.product_id;

                -- Calculate New Weighted Average Cost
                -- Current Value = Current Qty * Current Avg Cost (Handle nulls)
                v_old_total_value := (COALESCE(v_product.current_quantity, 0) * COALESCE(v_product.average_cost, 0));
                v_new_total_value := v_old_total_value + (v_line.quantity * v_line.unit_price);
                v_new_quantity := COALESCE(v_product.current_quantity, 0) + v_line.quantity;

                IF v_new_quantity > 0 THEN
                    v_new_avg_cost := v_new_total_value / v_new_quantity;
                ELSE
                    v_new_avg_cost := v_line.unit_price; -- Fallback
                END IF;

                UPDATE public.products_v2
                SET current_quantity = v_new_quantity,
                    average_cost = v_new_avg_cost
                WHERE id = v_line.product_id;

            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
