-- ============================================
-- Flexible Inventory Transaction (Open Transfer / Conversion)
-- Supports: Item to Item, Location to Location, Adjustments
-- ============================================

CREATE OR REPLACE FUNCTION create_inventory_transaction_rpc(
    p_date DATE,
    p_ref_number TEXT, -- Optional, or auto-generated
    p_description TEXT,
    p_lines JSONB -- Array of { itemId, quantity, unitCost?, notes? }
                  -- Quantity: Negative for OUT, Positive for IN
)
RETURNS JSONB AS $func$
DECLARE
    new_ref TEXT;
    rec JSONB;
    item_qt DECIMAL(19,4);
    item_cost DECIMAL(19,4);
    total_cost DECIMAL(19,4);
BEGIN
    -- 1. Generate Reference if needed
    IF p_ref_number IS NULL OR p_ref_number = '' THEN
        new_ref := 'INV-' || to_char(p_date, 'YYYYMMDD') || '-' || to_char(NOW(), 'HH24MISS');
    ELSE
        new_ref := p_ref_number;
    END IF;

    -- 2. Process Lines
    FOR rec IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        item_qt := (rec->>'quantity')::DECIMAL;
        
        -- Logic:
        -- If Quantity < 0 (OUT): Deduct from Stock (Update quantity_on_hand, consume layers?)
        -- If Quantity > 0 (IN): Add to Stock (Update quantity_on_hand, create layer?)
        
        -- A. Update Inventory Item Master
        UPDATE inventory_items 
        SET quantity_on_hand = quantity_on_hand + item_qt,
            updated_at = NOW()
        WHERE id = rec->>'itemId';
        
        -- B. Handle Costing (Simplified for now, assumes Average Cost or provided Cost)
        -- If IN: Use provided cost or current average? Usually provided for conversion.
        -- If OUT: Use Moving Average or FIFO (Layer logic).
        -- For this "Simple/Open" RPC, we will trust the provided cost or fetch standard.
        
        IF rec->>'unitCost' IS NOT NULL THEN
            item_cost := (rec->>'unitCost')::DECIMAL;
        ELSE
            -- Fetch current cost
            SELECT average_cost INTO item_cost FROM inventory_items WHERE id = rec->>'itemId';
            item_cost := COALESCE(item_cost, 0);
        END IF;

        -- C. Create Transaction Record
        INSERT INTO inventory_transactions (
            item_id, 
            transaction_type, 
            transaction_date, 
            quantity, 
            unit_cost, 
            total_cost, 
            reference_type, 
            reference_id, 
            notes
        ) VALUES (
            rec->>'itemId', 
            CASE WHEN item_qt > 0 THEN 'transfer_in' ELSE 'transfer_out' END,
            p_date,
            ABS(item_qt), -- Store positive magnitude, type indicates direction? 
                          -- Schema check: usually qty is signed or type determines. 
                          -- Standard: Qty is magnitude, Type is 'purchase'/'sale'/'adjustment'.
                          -- Let's use 'transfer'.
                          -- Ideally we store signed quantity or rely on type.
                          -- Let's store ABS and let type distinguish.
            item_cost,
            ABS(item_qt) * item_cost,
            'open_transfer',
            new_ref,
            COALESCE(rec->>'notes', p_description)
        );
        
        -- D. Layer Logic (Optional but recommended for consistency)
        IF item_qt > 0 THEN
             -- Create New Layer
             INSERT INTO inventory_layers (
                 item_id, purchase_date, quantity, remaining_quantity, unit_cost
             ) VALUES (
                 rec->>'itemId', p_date, item_qt, item_qt, item_cost
             );
        ELSE
             -- Consume Layers (FIFO) - Complex logic needed here if strict.
             -- For now, just reducing Qty On Hand is the "Open" request.
             NULL; 
        END IF;

    END LOOP;

    RETURN jsonb_build_object('success', true, 'ref', new_ref);
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Inventory Transaction Failed: %', SQLERRM;
END;
$func$ LANGUAGE plpgsql;
