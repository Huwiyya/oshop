-- ============================================
-- Flexible Item-to-Item Inventory Transfer Logic
-- ============================================

CREATE OR REPLACE FUNCTION transfer_inventory_item_rpc(
    p_source_item_id TEXT,
    p_target_item_id TEXT,
    p_quantity DECIMAL,
    p_date DATE,
    p_notes TEXT
)
RETURNS JSONB AS $func$
DECLARE
    transfer_ref TEXT;
    qty_to_consume DECIMAL(19,4) := p_quantity;
    layer_rec RECORD;
    take DECIMAL(19,4);
    total_carried_cost DECIMAL(19,4) := 0;
    source_item_name TEXT;
    target_item_name TEXT;
    source_current_qty DECIMAL(19,3);
    target_current_qty DECIMAL(19,3);
    target_current_avg_cost DECIMAL(19,4);
BEGIN
    -- 1. Validation
    IF p_source_item_id = p_target_item_id THEN
        RAISE EXCEPTION 'لا يمكن التحويل لنفس الصنف.';
    END IF;

    SELECT name_ar, quantity_on_hand INTO source_item_name, source_current_qty 
    FROM inventory_items WHERE id = p_source_item_id;
    
    SELECT name_ar, quantity_on_hand, average_cost INTO target_item_name, target_current_qty, target_current_avg_cost
    FROM inventory_items WHERE id = p_target_item_id;

    IF source_current_qty < p_quantity THEN
        RAISE EXCEPTION 'الكمية المتوفرة في % غير كافية (%)', source_item_name, source_current_qty;
    END IF;

    transfer_ref := 'TRF-' || to_char(NOW(), 'YYYYMMDD-HH24MISS');

    -- 2. Consume Source Layers (FIFO)
    FOR layer_rec IN 
        SELECT * FROM inventory_layers 
        WHERE item_id = p_source_item_id AND remaining_quantity > 0 
        ORDER BY purchase_date ASC, created_at ASC
    LOOP
        EXIT WHEN qty_to_consume <= 0;

        take := LEAST(layer_rec.remaining_quantity, qty_to_consume);
        
        UPDATE inventory_layers 
        SET remaining_quantity = remaining_quantity - take 
        WHERE id = layer_rec.id;

        total_carried_cost := total_carried_cost + (take * layer_rec.unit_cost);
        qty_to_consume := qty_to_consume - take;

        -- Log Outgoing Transaction for Source
        INSERT INTO inventory_transactions (
            item_id, transaction_type, transaction_date, quantity, 
            unit_cost, total_cost, reference_type, reference_id, layer_id, notes
        ) VALUES (
            p_source_item_id, 'transfer_out', p_date, take, 
            layer_rec.unit_cost, take * layer_rec.unit_cost, 
            'transfer', transfer_ref, layer_rec.id,
            COALESCE(p_notes, '') || ' (إلى ' || target_item_name || ')'
        );
    END LOOP;

    -- 3. Create Incoming Layers & Transactions for Target
    -- We'll create one layer for the target with the weighted average cost of what was taken
    DECLARE
        avg_carried_cost DECIMAL(19,4) := total_carried_cost / p_quantity;
        new_layer_id TEXT;
    BEGIN
        INSERT INTO inventory_layers (
            item_id, purchase_date, quantity, remaining_quantity, unit_cost, purchase_reference
        ) VALUES (
            p_target_item_id, p_date, p_quantity, p_quantity, avg_carried_cost, transfer_ref
        ) RETURNING id INTO new_layer_id;

        INSERT INTO inventory_transactions (
            item_id, transaction_type, transaction_date, quantity, 
            unit_cost, total_cost, reference_type, reference_id, layer_id, notes
        ) VALUES (
            p_target_item_id, 'transfer_in', p_date, p_quantity, 
            avg_carried_cost, total_carried_cost, 
            'transfer', transfer_ref, new_layer_id,
            COALESCE(p_notes, '') || ' (من ' || source_item_name || ')'
        );
        
        -- 4. Update Target Item Master (Weighted Average)
        -- (Target Qty * Target Avg + New Qty * New Cost) / Total Qty
        UPDATE inventory_items SET 
            quantity_on_hand = quantity_on_hand + p_quantity,
            average_cost = CASE 
                WHEN (quantity_on_hand + p_quantity) > 0 
                THEN ( (quantity_on_hand * average_cost) + total_carried_cost ) / (quantity_on_hand + p_quantity)
                ELSE average_cost
            END
        WHERE id = p_target_item_id;
    END;

    -- 5. Update Source Item Master (Just Qty)
    UPDATE inventory_items SET 
        quantity_on_hand = quantity_on_hand - p_quantity
    WHERE id = p_source_item_id;

    RETURN jsonb_build_object('success', true, 'ref', transfer_ref, 'cost', total_carried_cost);
END;
$func$ LANGUAGE plpgsql;
