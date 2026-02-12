-- =============================================================================
-- UPGRADE V2 TREASURY SCHEMA (Split Payments/Receipts Support)
-- =============================================================================

BEGIN;

-- 1. Create Payment Lines Table
CREATE TABLE IF NOT EXISTS public.payment_lines_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES public.payments_v2(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts_v2(id),
    amount DECIMAL(20, 4) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Receipt Lines Table
CREATE TABLE IF NOT EXISTS public.receipt_lines_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_id UUID NOT NULL REFERENCES public.receipts_v2(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts_v2(id),
    amount DECIMAL(20, 4) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Update Triggers to Handle Split Transactions

-- 3.1 Payment Journal Trigger (Multi-Line)Z
CREATE OR REPLACE FUNCTION public.create_payment_journal_v2() RETURNS TRIGGER AS $$
DECLARE 
    v_jid UUID;
    v_line RECORD;
    v_total_lines DECIMAL(20, 4) := 0;
BEGIN
    IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
        
        -- Create Journal Header
        INSERT INTO public.journal_entries_v2 (entry_number, date, description, status, source_type, source_id, total_debit, total_credit)
        VALUES (
            'JE-'||NEW.payment_number, 
            NEW.date, 
            'Payment: '||NEW.description, 
            'posted', 
            'payment', 
            NEW.id, 
            NEW.amount, 
            NEW.amount
        ) RETURNING id INTO v_jid;

        -- Credit Treasury (The Payer)
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description) 
        VALUES (v_jid, NEW.treasury_account_id, 0, NEW.amount, NEW.description);

        -- Debit The Expenses/Suppliers (The Payees)
        -- Option A: If we have lines, use them
        IF EXISTS (SELECT 1 FROM public.payment_lines_v2 WHERE payment_id = NEW.id) THEN
            FOR v_line IN SELECT * FROM public.payment_lines_v2 WHERE payment_id = NEW.id LOOP
                INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description) 
                VALUES (v_jid, v_line.account_id, v_line.amount, 0, COALESCE(v_line.description, NEW.description));
                v_total_lines := v_total_lines + v_line.amount;
            END LOOP;
            
            -- Validation check (Optional but good)
            IF v_total_lines != NEW.amount THEN
               RAISE WARNING 'Payment lines total (%) does not match header amount (%)', v_total_lines, NEW.amount;
            END IF;

        -- Option B: Fallback for Legacy/Simple Payments (Single Supplier/Account in Header)
        ELSIF NEW.supplier_account_id IS NOT NULL THEN
             INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description) 
             VALUES (v_jid, NEW.supplier_account_id, NEW.amount, 0, NEW.description);
        END IF;

        -- Link Journal to Payment
        UPDATE public.payments_v2 SET journal_entry_id = v_jid WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.2 Receipt Journal Trigger (Multi-Line)
CREATE OR REPLACE FUNCTION public.create_receipt_journal_v2() RETURNS TRIGGER AS $$
DECLARE 
    v_jid UUID;
    v_line RECORD;
    v_total_lines DECIMAL(20, 4) := 0;
BEGIN
    IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
        
        -- Create Journal Header
        INSERT INTO public.journal_entries_v2 (entry_number, date, description, status, source_type, source_id, total_debit, total_credit)
        VALUES (
            'JE-'||NEW.receipt_number, 
            NEW.date, 
            'Receipt: '||NEW.description, 
            'posted', 
            'receipt', 
            NEW.id, 
            NEW.amount, 
            NEW.amount
        ) RETURNING id INTO v_jid;

        -- Debit Treasury (The Receiver)
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description) 
        VALUES (v_jid, NEW.treasury_account_id, NEW.amount, 0, NEW.description);

        -- Credit The Revenue/Customers (The Payers)
        -- Option A: If we have lines
        IF EXISTS (SELECT 1 FROM public.receipt_lines_v2 WHERE receipt_id = NEW.id) THEN
            FOR v_line IN SELECT * FROM public.receipt_lines_v2 WHERE receipt_id = NEW.id LOOP
                INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description) 
                VALUES (v_jid, v_line.account_id, 0, v_line.amount, COALESCE(v_line.description, NEW.description));
            END LOOP;

        -- Option B: Fallback to Header Customer
        ELSIF NEW.customer_account_id IS NOT NULL THEN
             INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description) 
             VALUES (v_jid, NEW.customer_account_id, 0, NEW.amount, NEW.description);
        END IF;

        -- Link Journal to Receipt
        UPDATE public.receipts_v2 SET journal_entry_id = v_jid WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
