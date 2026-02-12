-- Add card_number to V2 Tables
ALTER TABLE public.inventory_layers_v2 ADD COLUMN IF NOT EXISTS card_number TEXT;
ALTER TABLE public.purchase_invoice_lines_v2 ADD COLUMN IF NOT EXISTS card_number TEXT;
ALTER TABLE public.sales_invoice_lines_v2 ADD COLUMN IF NOT EXISTS card_number TEXT;

-- Update Purchase Inventory Trigger to capture card_number
-- Update Purchase Inventory Trigger to capture card_number (and split into layers)
CREATE OR REPLACE FUNCTION public.process_purchase_inventory_v2() RETURNS TRIGGER AS $$
DECLARE 
    v_line RECORD;
    v_card_text TEXT;
    v_card_array TEXT[];
    v_card TEXT;
BEGIN
    IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
        FOR v_line IN SELECT * FROM public.purchase_invoice_lines_v2 WHERE invoice_id = NEW.id LOOP
            IF v_line.product_id IS NOT NULL THEN
                
                -- Check for card numbers (Split Logic)
                IF v_line.card_number IS NOT NULL AND v_line.card_number != '' THEN
                    -- Convert to array (handle newline)
                    v_card_array := string_to_array(v_line.card_number, E'\n');
                    
                    FOREACH v_card IN ARRAY v_card_array LOOP
                        -- Insert individual layer for each card
                        -- Quantity 1, Cost = Unit Price based on line
                        IF TRIM(v_card) != '' THEN
                             INSERT INTO public.inventory_layers_v2 (product_id, date, quantity, remaining_quantity, unit_cost, source_type, source_id, card_number)
                             VALUES (v_line.product_id, NEW.date, 1, 1, v_line.unit_price, 'purchase_invoice', NEW.id, TRIM(v_card));
                        END IF;
                    END LOOP;
                    
                    -- Update Product Quantity (Total)
                    UPDATE public.products_v2 SET current_quantity = current_quantity + v_line.quantity WHERE id = v_line.product_id;
                    
                ELSE
                    -- Standard Bulk Insert (No Cards)
                    INSERT INTO public.inventory_layers_v2 (product_id, date, quantity, remaining_quantity, unit_cost, source_type, source_id, card_number)
                    VALUES (v_line.product_id, NEW.date, v_line.quantity, v_line.quantity, v_line.unit_price, 'purchase_invoice', NEW.id, null);
                    
                    UPDATE public.products_v2 SET current_quantity = current_quantity + v_line.quantity WHERE id = v_line.product_id;
                END IF;

                -- Transaction Log (Keep as one aggregated transaction per line)
                INSERT INTO public.inventory_transactions_v2 (product_id, date, transaction_type, quantity, unit_cost, source_type, source_id)
                VALUES (v_line.product_id, NEW.date, 'purchase', v_line.quantity, v_line.unit_price, 'purchase_invoice', NEW.id);

            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update Sales Inventory Trigger to handle Specific Card Consumption
CREATE OR REPLACE FUNCTION public.process_sales_inventory_v2() RETURNS TRIGGER AS $$
DECLARE
    v_line RECORD;
    v_qty_needed DECIMAL;
    v_layer RECORD;
    v_consume DECIMAL;
    v_line_cogs DECIMAL;
BEGIN
    -- Part 1: Stock Deduction
    IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
        FOR v_line IN SELECT * FROM public.sales_invoice_lines_v2 WHERE invoice_id = NEW.id LOOP
            IF v_line.product_id IS NOT NULL THEN
                v_qty_needed := v_line.quantity;
                v_line_cogs := 0;
                
                -- STRATEGY: 
                -- If v_line.card_number is present, try to find that specific layer first.
                -- If not found or insufficient, fall back to FIFO? 
                -- For Cards, usually strict match is desired. 
                -- Let's try to find specific layer(s) matching the card number if provided.
                
                IF v_line.card_number IS NOT NULL THEN
                     FOR v_layer IN SELECT * FROM public.inventory_layers_v2 
                                    WHERE product_id = v_line.product_id 
                                    AND remaining_quantity > 0 
                                    AND card_number = v_line.card_number
                                    ORDER BY date ASC, created_at ASC LOOP
                        EXIT WHEN v_qty_needed <= 0;
                        IF v_layer.remaining_quantity >= v_qty_needed THEN v_consume := v_qty_needed; ELSE v_consume := v_layer.remaining_quantity; END IF;
                        
                        UPDATE public.inventory_layers_v2 SET remaining_quantity = remaining_quantity - v_consume WHERE id = v_layer.id;
                        v_line_cogs := v_line_cogs + (v_consume * v_layer.unit_cost);
                        v_qty_needed := v_qty_needed - v_consume;
                     END LOOP;
                END IF;

                -- If still need qty (or no card number provided), use FIFO on remaining layers
                -- (Note: exact card match might have consumed everything if valid. If user put wrong card number, we default to FIFO or error? 
                -- Current logic: Default to FIFO for remainder to ensure stock deduction happens.)
                IF v_qty_needed > 0 THEN
                    FOR v_layer IN SELECT * FROM public.inventory_layers_v2 
                                   WHERE product_id = v_line.product_id 
                                   AND remaining_quantity > 0 
                                   -- AND (card_number IS NULL OR card_number != v_line.card_number) -- Optional: prefer non-card layers? No, standard FIFO.
                                   ORDER BY date ASC, created_at ASC LOOP
                        EXIT WHEN v_qty_needed <= 0;
                        IF v_layer.remaining_quantity >= v_qty_needed THEN v_consume := v_qty_needed; ELSE v_consume := v_layer.remaining_quantity; END IF;
                        
                        UPDATE public.inventory_layers_v2 SET remaining_quantity = remaining_quantity - v_consume WHERE id = v_layer.id;
                        v_line_cogs := v_line_cogs + (v_consume * v_layer.unit_cost);
                        v_qty_needed := v_qty_needed - v_consume;
                    END LOOP;
                END IF;

                INSERT INTO public.inventory_transactions_v2 (product_id, date, transaction_type, quantity, unit_cost, source_type, source_id)
                VALUES (v_line.product_id, NEW.date, 'sale', -v_line.quantity, CASE WHEN v_line.quantity > 0 THEN v_line_cogs / v_line.quantity ELSE 0 END, 'sales_invoice', NEW.id);
                
                UPDATE public.products_v2 SET current_quantity = current_quantity - v_line.quantity WHERE id = v_line.product_id;
            END IF;
        END LOOP;
    END IF;

    -- Part 2: COGS Journal Lines
    IF NEW.journal_entry_id IS NOT NULL AND (OLD.journal_entry_id IS NULL OR OLD.journal_entry_id != NEW.journal_entry_id) THEN
        FOR v_line IN SELECT * FROM public.sales_invoice_lines_v2 WHERE invoice_id = NEW.id LOOP
            IF v_line.product_id IS NOT NULL THEN
                SELECT ABS(SUM(ABS(quantity) * unit_cost)) INTO v_line_cogs 
                FROM public.inventory_transactions_v2 
                WHERE source_id = NEW.id AND source_type = 'sales_invoice' AND product_id = v_line.product_id;
                
                IF v_line_cogs > 0 THEN
                     INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description)
                     SELECT NEW.journal_entry_id, p.cogs_account_id, v_line_cogs, 0, 'COGS: '||v_line.product_name FROM public.products_v2 p WHERE p.id = v_line.product_id;
                     INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description)
                     SELECT NEW.journal_entry_id, p.inventory_account_id, 0, v_line_cogs, 'Inventory: '||v_line.product_name FROM public.products_v2 p WHERE p.id = v_line.product_id;
                END IF;
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
