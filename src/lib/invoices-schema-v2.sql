-- =============================================================================
-- INVOICES SCHEMA V2 (FIXED TRIGGERS)
-- =============================================================================

BEGIN;

-- 1. Sales Invoices (Accounts Receivable / Revenue)
CREATE TABLE IF NOT EXISTS public.sales_invoices_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_account_id UUID NOT NULL REFERENCES public.accounts_v2(id),
    revenue_account_id UUID NOT NULL REFERENCES public.accounts_v2(id),
    inventory_account_id UUID REFERENCES public.accounts_v2(id),
    cogs_account_id UUID REFERENCES public.accounts_v2(id),
    
    amount DECIMAL(20, 4) NOT NULL CHECK (amount >= 0),
    tax_amount DECIMAL(20, 4) DEFAULT 0,
    total_amount DECIMAL(20, 4) GENERATED ALWAYS AS (amount + tax_amount) STORED,
    total_cost DECIMAL(20, 4) DEFAULT 0, -- Added for Profit Calculation
    
    description TEXT,
    status public.journal_status_v2 DEFAULT 'draft',
    journal_entry_id UUID REFERENCES public.journal_entries_v2(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sales_invoice_lines_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES public.sales_invoices_v2(id) ON DELETE CASCADE,
    product_id UUID,
    product_name TEXT,
    quantity DECIMAL(10, 2) DEFAULT 1,
    unit_price DECIMAL(20, 4) DEFAULT 0,
    line_total DECIMAL(20, 4) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- 2. Purchase Invoices (Accounts Payable / Expense)
CREATE TABLE IF NOT EXISTS public.purchase_invoices_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_account_id UUID NOT NULL REFERENCES public.accounts_v2(id),
    expense_account_id UUID NOT NULL REFERENCES public.accounts_v2(id),
    
    amount DECIMAL(20, 4) NOT NULL CHECK (amount >= 0),
    tax_amount DECIMAL(20, 4) DEFAULT 0,
    total_amount DECIMAL(20, 4) GENERATED ALWAYS AS (amount + tax_amount) STORED,
    
    description TEXT,
    status public.journal_status_v2 DEFAULT 'draft',
    journal_entry_id UUID REFERENCES public.journal_entries_v2(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Triggers for Auto-Journal (FIXED)

-- 3.1 Sales Invoice Trigger
CREATE OR REPLACE FUNCTION public.create_sales_journal_v2()
RETURNS TRIGGER AS $$
DECLARE
    v_journal_id UUID;
    v_old_status public.journal_status_v2;
BEGIN
    v_old_status := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END;
    
    IF NEW.status = 'posted' AND (v_old_status IS NULL OR v_old_status != 'posted') THEN
        -- Create Header
        INSERT INTO public.journal_entries_v2 (
            entry_number, date, description, status, source_type, source_id, total_debit, total_credit
        ) VALUES (
            'INV-' || NEW.invoice_number, NEW.date, 'Sales Invoice: ' || NEW.description, 'posted', 'sales_invoice', NEW.id, NEW.total_amount, NEW.total_amount
        ) RETURNING id INTO v_journal_id;
        
        -- Debit Customer (Receivable)
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description)
        VALUES (v_journal_id, NEW.customer_account_id, NEW.total_amount, 0, 'Invoice Receivable');
        
        -- Credit Revenue
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description)
        VALUES (v_journal_id, NEW.revenue_account_id, 0, NEW.amount, 'Sales Revenue');

        -- Link back
        UPDATE public.sales_invoices_v2 SET journal_entry_id = v_journal_id WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_sales_journal_v2 ON public.sales_invoices_v2;
CREATE TRIGGER trg_create_sales_journal_v2
    AFTER INSERT OR UPDATE ON public.sales_invoices_v2
    FOR EACH ROW
    EXECUTE FUNCTION public.create_sales_journal_v2();

-- 3.2 Purchase Invoice Trigger
CREATE OR REPLACE FUNCTION public.create_purchase_journal_v2()
RETURNS TRIGGER AS $$
DECLARE
    v_journal_id UUID;
    v_old_status public.journal_status_v2;
BEGIN
    v_old_status := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END;

    IF NEW.status = 'posted' AND (v_old_status IS NULL OR v_old_status != 'posted') THEN
        INSERT INTO public.journal_entries_v2 (
            entry_number, date, description, status, source_type, source_id, total_debit, total_credit
        ) VALUES (
            'BILL-' || NEW.invoice_number, NEW.date, 'Purchase Bill: ' || NEW.description, 'posted', 'purchase_invoice', NEW.id, NEW.total_amount, NEW.total_amount
        ) RETURNING id INTO v_journal_id;
        
        -- Debit Expense/Asset
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description)
        VALUES (v_journal_id, NEW.expense_account_id, NEW.total_amount, 0, 'Purchase Expense/Asset');
        
        -- Credit Supplier (Payable)
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description)
        VALUES (v_journal_id, NEW.supplier_account_id, 0, NEW.total_amount, 'Bill Payable');
        
        UPDATE public.purchase_invoices_v2 SET journal_entry_id = v_journal_id WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_purchase_journal_v2 ON public.purchase_invoices_v2;
CREATE TRIGGER trg_create_purchase_journal_v2
    AFTER INSERT OR UPDATE ON public.purchase_invoices_v2
    FOR EACH ROW
    EXECUTE FUNCTION public.create_purchase_journal_v2();

COMMIT;
