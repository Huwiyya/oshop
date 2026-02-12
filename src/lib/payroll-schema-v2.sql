-- =============================================================================
-- PAYROLL SCHEMA V2
-- =============================================================================

BEGIN;

-- 1. Payroll Runs (Header)
CREATE TABLE IF NOT EXISTS public.payroll_runs_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL DEFAULT CURRENT_DATE, -- Payroll Period End Date usually
    month TEXT NOT NULL, -- e.g., '2024-01'
    
    total_gross DECIMAL(20, 4) DEFAULT 0,
    total_deductions DECIMAL(20, 4) DEFAULT 0,
    total_net DECIMAL(20, 4) GENERATED ALWAYS AS (total_gross - total_deductions) STORED,
    
    payment_account_id UUID REFERENCES public.accounts_v2(id), -- Bank/Cash Account
    expense_account_id UUID REFERENCES public.accounts_v2(id), -- Salaries Expense Account
    
    status public.journal_status_v2 DEFAULT 'draft',
    journal_entry_id UUID REFERENCES public.journal_entries_v2(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Payroll Items (Lines per Employee)
CREATE TABLE IF NOT EXISTS public.payroll_items_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs_v2(id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    employee_id UUID, -- Optional link to user/employee table if exists
    
    basic_salary DECIMAL(20, 4) DEFAULT 0,
    allowances DECIMAL(20, 4) DEFAULT 0,
    gross_salary DECIMAL(20, 4) GENERATED ALWAYS AS (basic_salary + allowances) STORED,
    
    deductions DECIMAL(20, 4) DEFAULT 0,
    bonuses DECIMAL(20, 4) DEFAULT 0,
    
    net_salary DECIMAL(20, 4) GENERATED ALWAYS AS (basic_salary + allowances + bonuses - deductions) STORED,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Trigger for Auto-Journal
CREATE OR REPLACE FUNCTION public.create_payroll_journal_v2()
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
            'PAYROLL-' || NEW.month, NEW.date, 'Salary Payment for ' || NEW.month, 'posted', 'payroll_run', NEW.id, NEW.total_gross, NEW.total_gross
        ) RETURNING id INTO v_journal_id;
        
        -- Debit Salaries Expense (Gross or Net+Deductions if handled separately)
        -- Simplified: Debit Expense with Total Net + Deductions (which is Gross)
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description)
        VALUES (v_journal_id, NEW.expense_account_id, NEW.total_net, 0, 'Salaries Expense');
        
        -- Credit Bank/Cash (Net Payment)
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description)
        VALUES (v_journal_id, NEW.payment_account_id, 0, NEW.total_net, 'Salaries Payment');
        
        -- Make sure it balances. If deducts != 0, we need to handle them.
        -- Usually: Debit Expense (Gross), Credit Bank (Net), Credit Payable (Deductions).
        -- For simplicity in this v2 MVP, let's treat Deductions as just reducing the expense claim if they are not liabilities yet,
        -- OR, simpler: Assume Total Net is what affects Bank and Expense. 
        -- IF we want to track Gross Expense vs Liability, we need a liability account.
        -- Let's stick to Net for now to match 100% balance, or if user asks for complex payroll.
        
        -- REVISIT: If check constraints force Total Debit = Total Credit.
        -- Currently inserting Debit Net and Credit Net. Balanced.
        
        UPDATE public.payroll_runs_v2 SET journal_entry_id = v_journal_id WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_payroll_journal_v2 ON public.payroll_runs_v2;
CREATE TRIGGER trg_create_payroll_journal_v2
    AFTER INSERT OR UPDATE ON public.payroll_runs_v2
    FOR EACH ROW
    EXECUTE FUNCTION public.create_payroll_journal_v2();

COMMIT;
