-- =============================================================================
-- INVENTORY SCHEMA V2
-- =============================================================================

BEGIN;

-- 1. Products Catalog
CREATE TABLE IF NOT EXISTS public.products_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT UNIQUE,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    type TEXT DEFAULT 'product', -- product, service
    
    -- Accounts (Per product or category)
    inventory_account_id UUID REFERENCES public.accounts_v2(id), -- Asset
    cogs_account_id UUID REFERENCES public.accounts_v2(id),      -- Expense
    sales_account_id UUID REFERENCES public.accounts_v2(id),     -- Revenue
    
    current_quantity DECIMAL(20, 4) DEFAULT 0,
    average_cost DECIMAL(20, 4) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Purchase Invoice Lines (Missing in initial schema)
CREATE TABLE IF NOT EXISTS public.purchase_invoice_lines_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES public.purchase_invoices_v2(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products_v2(id), -- Nullable for expenses without items
    description TEXT,
    quantity DECIMAL(20, 4) DEFAULT 1,
    unit_price DECIMAL(20, 4) DEFAULT 0,
    line_total DECIMAL(20, 4) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- 3. Inventory Layers (FIFO)
CREATE TABLE IF NOT EXISTS public.inventory_layers_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products_v2(id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    quantity DECIMAL(20, 4) NOT NULL,
    remaining_quantity DECIMAL(20, 4) NOT NULL,
    unit_cost DECIMAL(20, 4) NOT NULL,
    
    source_type TEXT, -- purchase_invoice, adjustment
    source_id UUID,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Inventory Transactions (History)
CREATE TABLE IF NOT EXISTS public.inventory_transactions_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products_v2(id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_type TEXT NOT NULL, -- purchase, sale, adjustment
    
    quantity DECIMAL(20, 4) NOT NULL, -- Positive for IN, Negative for OUT
    unit_cost DECIMAL(20, 4) NOT NULL,
    total_cost DECIMAL(20, 4) GENERATED ALWAYS AS (ABS(quantity) * unit_cost) STORED,
    
    layer_id UUID REFERENCES public.inventory_layers_v2(id), -- Linked layer for IN
    
    source_type TEXT,
    source_id UUID,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Helper Function: Process Inventory Purchase
CREATE OR REPLACE FUNCTION public.process_purchase_inventory_v2()
RETURNS TRIGGER AS $$
DECLARE
    v_line RECORD;
BEGIN
    -- Only process if status changed to 'posted'
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
                
                -- 3. Update Product Qty
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


-- 6. Helper Function: Process Inventory Sale (FIFO Consumption)
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
    END IF;

    -- 2. Handle COGS Journal Lines (Strictly when Journal ID is assigned)
    IF NEW.journal_entry_id IS NOT NULL AND (OLD.journal_entry_id IS NULL OR OLD.journal_entry_id != NEW.journal_entry_id) THEN
        FOR v_line IN SELECT * FROM public.sales_invoice_lines_v2 WHERE invoice_id = NEW.id LOOP
            IF v_line.product_id IS NOT NULL THEN
                -- Re-calculate COGS or fetch from somewhere? 
                -- We didn't store line_cogs in the table. 
                -- Calculating it again blindly might be risky if layers changed, but in same transaction it's fine.
                -- BETTER: Store `cogs_amount` on invoice_line?
                -- For now, let's re-calculate cleanly or just grab from transactions?
                -- Grabbing from transactions is safer to match exactly what was deducted.
                
                SELECT ABS(SUM(total_cost)) INTO v_line_cogs 
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
