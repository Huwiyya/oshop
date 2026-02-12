-- ============================================
-- Update Sales and Purchase RPCs for Service Items
-- ============================================

-- 1. Update Create Sales Invoice RPC
CREATE OR REPLACE FUNCTION create_sales_invoice_rpc(
    invoice_data JSONB, -- { customerId, date, currency, rate, paidAmount, paymentAccountId, notes }
    items JSONB -- Array of { itemId, quantity, unitPrice, cost(optional) }
)
RETURNS JSONB AS $func$
DECLARE
    new_invoice_id TEXT;
    new_invoice_number TEXT;
    total_amount DECIMAL(19,4) := 0;
    subtotal DECIMAL(19,4) := 0;
    txn_cost DECIMAL(19,4) := 0;
    total_cogs DECIMAL(19,4) := 0;
    
    -- Variables for looping
    item_rec JSONB;
    layer_rec RECORD;
    qty_needed DECIMAL(19,4);
    qty_deducted DECIMAL(19,4);
    
    -- Item Details
    v_item_type TEXT;
    v_revenue_account_id TEXT;
    v_inventory_account_id TEXT;
    v_cogs_account_id TEXT;
    
    -- Journal IDs
    revenue_lines JSONB := '[]'::JSONB;
    cogs_lines JSONB := '[]'::JSONB;
    
    -- Helper
    year_prefix TEXT;
    seq_count INTEGER;
BEGIN
    -- A. Generate Invoice Number
    year_prefix := to_char((invoice_data->>'date')::DATE, 'YYYY');
    SELECT COUNT(*) + 1000 INTO seq_count FROM sales_invoices; 
    new_invoice_number := 'INV-' || year_prefix || '-' || seq_count;

    -- B. Calculate Totals & Prepare Lines
    FOR item_rec IN SELECT * FROM jsonb_array_elements(items)
    LOOP
        subtotal := subtotal + ((item_rec->>'quantity')::DECIMAL * (item_rec->>'unitPrice')::DECIMAL);
    END LOOP;
    
    total_amount := subtotal;

    -- C. Insert Invoice Header
    INSERT INTO sales_invoices (
        invoice_number, invoice_date, customer_account_id,
        currency, exchange_rate, subtotal, total_amount,
        paid_amount, remaining_amount, payment_status, notes,
        created_at, updated_at
    ) VALUES (
        new_invoice_number,
        (invoice_data->>'date')::DATE,
        invoice_data->>'customerId',
        COALESCE(invoice_data->>'currency', 'LYD'),
        COALESCE((invoice_data->>'rate')::DECIMAL, 1),
        subtotal,
        total_amount,
        (invoice_data->>'paidAmount')::DECIMAL,
        total_amount - (invoice_data->>'paidAmount')::DECIMAL,
        CASE 
            WHEN (invoice_data->>'paidAmount')::DECIMAL >= total_amount THEN 'paid'
            WHEN (invoice_data->>'paidAmount')::DECIMAL > 0 THEN 'partial'
            ELSE 'unpaid'
        END,
        invoice_data->>'notes',
        NOW(), NOW()
    ) RETURNING id INTO new_invoice_id;

    -- D. Process Items & Inventory
    FOR item_rec IN SELECT * FROM jsonb_array_elements(items)
    LOOP
        -- 1. Insert Line
        INSERT INTO sales_invoice_lines (
            invoice_id, item_id, description, quantity, unit_price, total
        ) VALUES (
            new_invoice_id,
            item_rec->>'itemId',
            item_rec->>'description',
            (item_rec->>'quantity')::DECIMAL,
            (item_rec->>'unitPrice')::DECIMAL,
            (item_rec->>'quantity')::DECIMAL * (item_rec->>'unitPrice')::DECIMAL
        );

        -- GET ITEM DETAILS (Type, Accounts)
        -- Support both 'products' table and legacy 'inventory_items' view if strictly needed, 
        -- but here we assume 'products' table or joining.
        -- We will query 'products' table directly. Assuming 'inventory_items' is a view or table that has 'type'.
        -- If 'inventory_items' is the table, we added 'type' there.
        SELECT 
            type, 
            revenue_account_id, 
            inventory_account_id, 
            cogs_account_id 
        INTO 
            v_item_type, 
            v_revenue_account_id, 
            v_inventory_account_id, 
            v_cogs_account_id
        FROM products -- Or inventory_items if that is the main table
        WHERE id = (item_rec->>'itemId');

        -- Default Type if null
        v_item_type := COALESCE(v_item_type, 'product');

        -- Resolve Revenue Account
        IF v_revenue_account_id IS NULL THEN
             -- Default Sales (4100 or closest)
             SELECT id INTO v_revenue_account_id FROM accounts WHERE account_code = '4100' LIMIT 1;
             IF v_revenue_account_id IS NULL THEN
                -- Fallback to first available revenue account
                SELECT id INTO v_revenue_account_id FROM accounts WHERE account_code LIKE '41%' ORDER BY account_code ASC LIMIT 1;
             END IF;
        END IF;

        -- BRANCH LOGIC BASED ON TYPE
        IF v_item_type = 'service' THEN
            -- SERVICE ITEM LOGIC
            -- No Inventory Deduction
            -- No COGS (unless cost is provided manually? For now assume no COGS for pure service invoice)
            
            -- Add to Revenue Lines
            revenue_lines := revenue_lines || jsonb_build_object(
                'accountId', v_revenue_account_id,
                'description', 'إيراد خدمات - ' || (item_rec->>'description'),
                'debit', 0,
                'credit', (item_rec->>'quantity')::DECIMAL * (item_rec->>'unitPrice')::DECIMAL
            );

        ELSE
            -- PRODUCT (INVENTORY) LOGIC
            -- 2. Inventory Deduction Logic
            qty_needed := (item_rec->>'quantity')::DECIMAL;
            txn_cost := 0;

            -- Resolve Accounts
            IF v_inventory_account_id IS NULL THEN
                -- Default Inventory (1130)
                SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '1130' LIMIT 1;
            END IF;
            IF v_cogs_account_id IS NULL THEN
                -- Default COGS (5001)
                SELECT id INTO v_cogs_account_id FROM accounts WHERE account_code = '5001' LIMIT 1;
                IF v_cogs_account_id IS NULL THEN
                     -- Fallback to first available Expense if COGS missing
                     SELECT id INTO v_cogs_account_id FROM accounts WHERE account_code LIKE '5%' ORDER BY account_code ASC LIMIT 1;
                END IF;
            END IF;

            -- CHECK FOR SPECIFIC LAYERS
            IF (item_rec->'selectedLayerIds') IS NOT NULL AND jsonb_array_length(item_rec->'selectedLayerIds') > 0 THEN
                FOR layer_id_text IN SELECT * FROM jsonb_array_elements_text(item_rec->'selectedLayerIds')
                LOOP
                     SELECT * INTO layer_rec FROM inventory_layers WHERE id = layer_id_text;
                     IF layer_rec.quantity IS NOT NULL THEN
                        UPDATE inventory_layers 
                        SET remaining_quantity = remaining_quantity - 1 
                        WHERE id = layer_id_text;

                        txn_cost := txn_cost + (1 * layer_rec.unit_cost);
                        
                        INSERT INTO inventory_transactions (
                            item_id, transaction_type, transaction_date, quantity, 
                            unit_cost, total_cost, layer_id, reference_type, reference_id, notes
                        ) VALUES (
                            item_rec->>'itemId', 'sale', (invoice_data->>'date')::DATE,
                            1, layer_rec.unit_cost, layer_rec.unit_cost,
                            layer_rec.id, 'sales_invoice', new_invoice_number, 'بيع بطاقة محددة'
                        );
                     END IF;
                END LOOP;
            ELSE
                -- FIFO Logic
                FOR layer_rec IN 
                    SELECT * FROM inventory_layers 
                    WHERE item_id = (item_rec->>'itemId') AND remaining_quantity > 0 
                    ORDER BY created_at ASC
                LOOP
                    IF qty_needed <= 0 THEN EXIT; END IF;

                    IF layer_rec.remaining_quantity >= qty_needed THEN
                        qty_deducted := qty_needed;
                    ELSE
                        qty_deducted := layer_rec.remaining_quantity;
                    END IF;

                    UPDATE inventory_layers 
                    SET remaining_quantity = remaining_quantity - qty_deducted
                    WHERE id = layer_rec.id;

                    txn_cost := txn_cost + (qty_deducted * layer_rec.unit_cost);
                    qty_needed := qty_needed - qty_deducted;

                    INSERT INTO inventory_transactions (
                        item_id, transaction_type, transaction_date, quantity, 
                        unit_cost, total_cost, layer_id, reference_type, reference_id
                    ) VALUES (
                        item_rec->>'itemId', 'sale', (invoice_data->>'date')::DATE,
                        qty_deducted, layer_rec.unit_cost, (qty_deducted * layer_rec.unit_cost),
                        layer_rec.id, 'sales_invoice', new_invoice_number
                    );
                END LOOP;
                
                IF qty_needed > 0 THEN
                    RAISE EXCEPTION 'Insufficient stock for item %', (item_rec->>'itemId');
                END IF;
            END IF;

            total_cogs := total_cogs + txn_cost;

            -- Prepare Journal Lines (Revenue + COGS/Inventory)
            
            -- Revenue Credit (Product)
            revenue_lines := revenue_lines || jsonb_build_object(
                'accountId', v_revenue_account_id,
                'description', 'إيراد مبيعات - ' || new_invoice_number,
                'debit', 0,
                'credit', (item_rec->>'quantity')::DECIMAL * (item_rec->>'unitPrice')::DECIMAL
            );
            
            -- COGS Debit & Inventory Credit
            cogs_lines := cogs_lines || jsonb_build_object(
                'accountId', v_cogs_account_id, -- Debit COGS
                'description', 'ت.ب.م - ' || new_invoice_number,
                'debit', txn_cost,
                'credit', 0
            ) || jsonb_build_object(
                'accountId', v_inventory_account_id, -- Credit Inventory
                'description', 'صرف مخزون - ' || new_invoice_number,
                'debit', 0,
                'credit', txn_cost
            );
            
            -- Update Invoice Line with actual Cost
            UPDATE sales_invoice_lines 
            SET unit_cost = txn_cost / (item_rec->>'quantity')::DECIMAL
            WHERE invoice_id = new_invoice_id AND item_id = (item_rec->>'itemId');
            
            -- Update Inventory Quantity on Hand
            UPDATE products -- Assuming 'products' is the table name
            SET quantity_on_hand = quantity_on_hand - (item_rec->>'quantity')::DECIMAL
            WHERE id = (item_rec->>'itemId');
        END IF;

    END LOOP;

    -- Update Total Cost on Invoice
    UPDATE sales_invoices SET total_cost = total_cogs WHERE id = new_invoice_id;

    -- E. Create Journal Entries
    -- 1. Sales Entry: Dr AR / Cr Revenue (Summarized or detailed)
    -- We'll just dump revenue_lines (which contains Credits).
    PERFORM create_journal_entry_rpc(
        (invoice_data->>'date')::DATE,
        'فاتورة مبيعات ' || new_invoice_number,
        'sales_invoice',
        new_invoice_number,
        (
            jsonb_build_array(
                jsonb_build_object('accountId', invoice_data->>'customerId', 'description', 'فاتورة مبيعات', 'debit', total_amount, 'credit', 0)
            ) || revenue_lines
        ),
        true -- Hidden
    );

    -- 2. COGS Entry (Only for Products)
    IF total_cogs > 0 THEN
        PERFORM create_journal_entry_rpc(
            (invoice_data->>'date')::DATE,
            'تكلفة مبيعات ' || new_invoice_number,
            'sales_cogs',
            new_invoice_number,
            cogs_lines,
            true -- Hidden
        );
    END IF;

    -- 3. Payment Entry
    IF (invoice_data->>'paidAmount')::DECIMAL > 0 THEN
        PERFORM create_journal_entry_rpc(
             (invoice_data->>'date')::DATE,
             'سداد فاتورة ' || new_invoice_number,
             'receipt',
             new_invoice_number,
             jsonb_build_array(
                 jsonb_build_object('accountId', invoice_data->>'paymentAccountId', 'description', 'تحصيل نقدية', 'debit', (invoice_data->>'paidAmount')::DECIMAL, 'credit', 0),
                 jsonb_build_object('accountId', invoice_data->>'customerId', 'description', 'سداد عميل', 'debit', 0, 'credit', (invoice_data->>'paidAmount')::DECIMAL)
             )
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'invoice_id', new_invoice_id, 'invoice_number', new_invoice_number);
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Sales Invoice Creation Failed: %', SQLERRM;
END;
$func$ LANGUAGE plpgsql;


-- 2. Create Purchase Invoice RPC
CREATE OR REPLACE FUNCTION create_purchase_invoice_rpc(
    invoice_data JSONB, -- { supplierId, date, currency, rate, paidAmount, paymentAccountId, notes }
    items JSONB -- Array of { itemId, quantity, unitPrice, cardNumbers[]? }
)
RETURNS JSONB AS $func$
DECLARE
    new_invoice_id TEXT;
    new_invoice_number TEXT;
    total_amount DECIMAL(19,4) := 0;
    subtotal DECIMAL(19,4) := 0;
    
    -- Variables
    item_rec JSONB;
    card_num TEXT;
    
    -- Item Details
    v_item_type TEXT;
    v_inventory_account_id TEXT;
    v_expense_account_id TEXT;
    v_target_account_id TEXT; -- Where the Debit goes (Inventory or Expense)
    
    -- Journal Info
    payable_lines JSONB := '[]'::JSONB; -- Supplier Credits
    debit_lines JSONB := '[]'::JSONB; -- Inventory/Expense Debits
    
    supplier_account_id TEXT;
    
    -- Helper
    year_prefix TEXT;
    seq_count INTEGER;
BEGIN
    -- A. Generate Invoice Number
    year_prefix := to_char((invoice_data->>'date')::DATE, 'YYYY');
    SELECT COUNT(*) + 1000 INTO seq_count FROM purchase_invoices;
    new_invoice_number := 'PI-' || year_prefix || '-' || seq_count;

    -- B. Calculate Totals
    FOR item_rec IN SELECT * FROM jsonb_array_elements(items)
    LOOP
        subtotal := subtotal + ((item_rec->>'quantity')::DECIMAL * (item_rec->>'unitPrice')::DECIMAL);
    END LOOP;
    
    total_amount := subtotal;

    -- C. Insert Invoice Header
    INSERT INTO purchase_invoices (
        invoice_number, invoice_date, supplier_account_id,
        currency, exchange_rate, subtotal, total_amount,
        paid_amount, remaining_amount, payment_status, notes,
        created_at, updated_at
    ) VALUES (
        new_invoice_number,
        (invoice_data->>'date')::DATE,
        invoice_data->>'supplierId',
        COALESCE(invoice_data->>'currency', 'LYD'),
        COALESCE((invoice_data->>'rate')::DECIMAL, 1),
        subtotal,
        total_amount,
        (invoice_data->>'paidAmount')::DECIMAL,
        total_amount - (invoice_data->>'paidAmount')::DECIMAL,
        CASE 
            WHEN (invoice_data->>'paidAmount')::DECIMAL >= total_amount THEN 'paid'
            WHEN (invoice_data->>'paidAmount')::DECIMAL > 0 THEN 'partial'
            ELSE 'unpaid'
        END,
        invoice_data->>'notes',
        NOW(), NOW()
    ) RETURNING id INTO new_invoice_id;

    -- D. Process Items & Inventory Layers
    FOR item_rec IN SELECT * FROM jsonb_array_elements(items)
    LOOP
        -- 1. Insert Line
        INSERT INTO purchase_invoice_lines (
            invoice_id, item_id, description, quantity, unit_price, total
        ) VALUES (
            new_invoice_id,
            item_rec->>'itemId',
            item_rec->>'description',
            (item_rec->>'quantity')::DECIMAL,
            (item_rec->>'unitPrice')::DECIMAL,
            (item_rec->>'quantity')::DECIMAL * (item_rec->>'unitPrice')::DECIMAL
        );

        -- GET ITEM DETAILS
        SELECT 
            type, 
            inventory_account_id, 
            expense_account_id 
        INTO 
            v_item_type, 
            v_inventory_account_id, 
            v_expense_account_id
        FROM inventory_items 
        WHERE id = (item_rec->>'itemId');

        v_item_type := COALESCE(v_item_type, 'product');

        -- DECIDE TARGET ACCOUNT
        IF v_item_type = 'service' THEN
            -- Service Logic: Expense Account
            IF v_expense_account_id IS NULL THEN
                 -- Fallback to a default Expense Account (e.g., General Expenses 5xxx or Cost of Services)
                 SELECT id INTO v_target_account_id FROM accounts WHERE account_code LIKE '5%' ORDER BY account_code ASC LIMIT 1; 
                 -- Ideally use 5001 if available as generic cost
                 SELECT id INTO v_target_account_id FROM accounts WHERE account_code = '5001' LIMIT 1;
            ELSE
                 v_target_account_id := v_expense_account_id;
            END IF;
            
            -- Prepare Debit Line (Expense)
            debit_lines := debit_lines || jsonb_build_object(
                'accountId', v_target_account_id,
                'description', 'مصروف خدمات - ' || (item_rec->>'description'),
                'debit', (item_rec->>'quantity')::DECIMAL * (item_rec->>'unitPrice')::DECIMAL,
                'credit', 0
            );

        ELSE
            -- Product Logic: Inventory Account + Layers
            
            -- Resolve Inventory Account
            IF v_inventory_account_id IS NULL THEN
                SELECT id INTO v_target_account_id FROM accounts WHERE account_code = '1130' LIMIT 1;
            ELSE
                v_target_account_id := v_inventory_account_id;
            END IF;

            -- Prepare Debit Line (Inventory)
            debit_lines := debit_lines || jsonb_build_object(
                'accountId', v_target_account_id,
                'description', 'مخزون - ' || (item_rec->>'description'),
                'debit', (item_rec->>'quantity')::DECIMAL * (item_rec->>'unitPrice')::DECIMAL,
                'credit', 0
            );

            -- Create Layers & Transactions (Inventory Only)
            IF jsonb_array_length(item_rec->'cardNumbers') > 0 THEN
                FOR card_num IN SELECT * FROM jsonb_array_elements_text(item_rec->'cardNumbers')
                LOOP
                    WITH new_layer AS (
                        INSERT INTO inventory_layers (
                            item_id, purchase_date, quantity, remaining_quantity, unit_cost, card_number, purchase_reference
                        ) VALUES (
                            item_rec->>'itemId', (invoice_data->>'date')::DATE, 1, 1, (item_rec->>'unitPrice')::DECIMAL, card_num, new_invoice_number
                        ) RETURNING id
                    )
                    INSERT INTO inventory_transactions (
                        item_id, transaction_type, transaction_date, quantity, 
                        unit_cost, total_cost, layer_id, reference_type, reference_id, notes
                    ) VALUES (
                        item_rec->>'itemId', 'purchase', (invoice_data->>'date')::DATE,
                        1, (item_rec->>'unitPrice')::DECIMAL, (item_rec->>'unitPrice')::DECIMAL,
                        (SELECT id FROM new_layer), 'purchase_invoice', new_invoice_number, 'بطاقة رقم ' || card_num
                    );
                END LOOP;
            ELSE
                WITH new_layer AS (
                    INSERT INTO inventory_layers (
                        item_id, purchase_date, quantity, remaining_quantity, unit_cost, purchase_reference
                    ) VALUES (
                        item_rec->>'itemId', (invoice_data->>'date')::DATE, 
                        (item_rec->>'quantity')::DECIMAL, 
                        (item_rec->>'quantity')::DECIMAL, 
                        (item_rec->>'unitPrice')::DECIMAL,
                        new_invoice_number
                    ) RETURNING id
                )
                INSERT INTO inventory_transactions (
                    item_id, transaction_type, transaction_date, quantity, 
                    unit_cost, total_cost, layer_id, reference_type, reference_id
                ) VALUES (
                    item_rec->>'itemId', 'purchase', (invoice_data->>'date')::DATE,
                    (item_rec->>'quantity')::DECIMAL, 
                    (item_rec->>'unitPrice')::DECIMAL, 
                    (item_rec->>'quantity')::DECIMAL * (item_rec->>'unitPrice')::DECIMAL,
                    (SELECT id FROM new_layer), 'purchase_invoice', new_invoice_number
                );
            END IF;

            -- Update Inventory Quantity on Hand
            UPDATE products 
            SET quantity_on_hand = quantity_on_hand + (item_rec->>'quantity')::DECIMAL
            WHERE id = (item_rec->>'itemId');
        END IF;
        
    END LOOP;

    -- E. Create Journal Entry
    supplier_account_id := invoice_data->>'supplierId';

    -- Dr Inventory/Expense, Cr Supplier
    PERFORM create_journal_entry_rpc(
        (invoice_data->>'date')::DATE,
        'فاتورة شراء ' || new_invoice_number,
        'purchase_invoice',
        new_invoice_number,
        (
            debit_lines || 
            jsonb_build_array(
                jsonb_build_object('accountId', supplier_account_id, 'description', 'استحقاق مورد', 'debit', 0, 'credit', total_amount)
            )
        ),
        true -- Hidden
    );

    -- F. Payment Entry
    IF (invoice_data->>'paidAmount')::DECIMAL > 0 THEN
        PERFORM create_journal_entry_rpc(
             (invoice_data->>'date')::DATE,
             'سداد فاتورة شراء ' || new_invoice_number,
             'payment',
             new_invoice_number,
             jsonb_build_array(
                 jsonb_build_object('accountId', supplier_account_id, 'description', 'سداد مورد', 'debit', (invoice_data->>'paidAmount')::DECIMAL, 'credit', 0),
                 jsonb_build_object('accountId', invoice_data->>'paymentAccountId', 'description', 'دفع نقدية', 'debit', 0, 'credit', (invoice_data->>'paidAmount')::DECIMAL)
             )
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'invoice_id', new_invoice_id, 'invoice_number', new_invoice_number);
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Purchase Invoice Creation Failed: %', SQLERRM;
END;
$func$ LANGUAGE plpgsql;
