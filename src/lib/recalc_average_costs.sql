DO $$
DECLARE
    r RECORD;
    v_total_qty DECIMAL;
    v_total_value DECIMAL;
    v_avg_cost DECIMAL;
BEGIN
    FOR r IN SELECT id FROM public.products_v2 LOOP
        -- Calculate from layers (Active Stock)
        -- Note: This is "Current Inventory Value" / "Current Qty"
        SELECT COALESCE(SUM(remaining_quantity), 0), COALESCE(SUM(remaining_quantity * unit_cost), 0)
        INTO v_total_qty, v_total_value
        FROM public.inventory_layers_v2
        WHERE product_id = r.id AND remaining_quantity > 0;

        IF v_total_qty > 0 THEN
            v_avg_cost := v_total_value / v_total_qty;
        ELSE
            v_avg_cost := 0;
            -- Or keep last known cost? Better 0 if no stock.
        END IF;

        UPDATE public.products_v2
        SET average_cost = v_avg_cost,
            current_quantity = v_total_qty -- Sync qty too just in case
        WHERE id = r.id;
    END LOOP;
END $$;
