-- =============================================================================
-- FINAL ACCOUNTING SCHEMA V2 - ZERO ERROR STANDARD
-- =============================================================================
-- This schema assumes a fresh start or a migration to v2 tables.
-- It enforces strict accounting principles at the database level.
-- Includes: Core GL, Sub-ledgers (Receipts/Payments), Inventory Integration.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. CORE CONFIGURATION & TYPES
-- =============================================================================

DROP TYPE IF EXISTS public.account_category_v2 CASCADE;
CREATE TYPE public.account_category_v2 AS ENUM (
    'asset', 'liability', 'equity', 'revenue', 'expense'
);

DROP TYPE IF EXISTS public.normal_balance_v2 CASCADE;
CREATE TYPE public.normal_balance_v2 AS ENUM (
    'debit', 'credit'
);

DROP TYPE IF EXISTS public.journal_status_v2 CASCADE;
CREATE TYPE public.journal_status_v2 AS ENUM (
    'draft', 'posted', 'archived', 'cancelled'
);

DROP TYPE IF EXISTS public.payment_method_v2 CASCADE;
CREATE TYPE public.payment_method_v2 AS ENUM (
    'cash', 'bank_transfer', 'check', 'credit_card', 'wallet'
);

-- =============================================================================
-- 2. CHART OF ACCOUNTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.account_types_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL UNIQUE,
    category public.account_category_v2 NOT NULL,
    normal_balance public.normal_balance_v2 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.account_types_v2 (name_ar, name_en, category, normal_balance) VALUES
('أصول', 'Assets', 'asset', 'debit'),
('خصوم', 'Liabilities', 'liability', 'credit'),
('حقوق ملكية', 'Equity', 'equity', 'credit'),
('إيرادات', 'Revenue', 'revenue', 'credit'),
('مصروفات', 'Expenses', 'expense', 'debit')
ON CONFLICT (name_en) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.accounts_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    type_id UUID NOT NULL REFERENCES public.account_types_v2(id) ON DELETE RESTRICT,
    parent_id UUID REFERENCES public.accounts_v2(id) ON DELETE RESTRICT,
    level INTEGER NOT NULL,
    is_group BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE,
    current_balance DECIMAL(20, 4) DEFAULT 0.0000,
    currency TEXT DEFAULT 'LYD',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_accounts_v2_parent ON public.accounts_v2(parent_id);
CREATE INDEX idx_accounts_v2_code ON public.accounts_v2(code);

-- =============================================================================
-- 3. GENERAL LEDGER (Journal Entries)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.journal_entries_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    status public.journal_status_v2 DEFAULT 'draft',
    source_type TEXT, -- 'invoice', 'payment', 'receipt', 'manual'
    source_id UUID,
    total_debit DECIMAL(20, 4) DEFAULT 0.0000,
    total_credit DECIMAL(20, 4) DEFAULT 0.0000,
    created_by UUID,
    posted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.journal_lines_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_id UUID NOT NULL REFERENCES public.journal_entries_v2(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts_v2(id) ON DELETE RESTRICT,
    debit DECIMAL(20, 4) DEFAULT 0.0000 CHECK (debit >= 0),
    credit DECIMAL(20, 4) DEFAULT 0.0000 CHECK (credit >= 0),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT line_must_have_amount CHECK (debit > 0 OR credit > 0),
    CONSTRAINT line_cannot_be_both CHECK (debit = 0 OR credit = 0)
);

CREATE INDEX idx_lines_v2_journal ON public.journal_lines_v2(journal_id);
CREATE INDEX idx_lines_v2_account ON public.journal_lines_v2(account_id);

-- =============================================================================
-- 4. SUB-LEDGERS (Receipts & Payments)
-- =============================================================================

-- Receipts (Money In)
CREATE TABLE IF NOT EXISTS public.receipts_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_account_id UUID REFERENCES public.accounts_v2(id),
    treasury_account_id UUID NOT NULL REFERENCES public.accounts_v2(id), -- Cash/Bank
    amount DECIMAL(20, 4) NOT NULL CHECK (amount > 0),
    description TEXT,
    status public.journal_status_v2 DEFAULT 'draft',
    journal_entry_id UUID REFERENCES public.journal_entries_v2(id),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments (Money Out)
CREATE TABLE IF NOT EXISTS public.payments_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_account_id UUID REFERENCES public.accounts_v2(id),
    treasury_account_id UUID NOT NULL REFERENCES public.accounts_v2(id),
    amount DECIMAL(20, 4) NOT NULL CHECK (amount > 0),
    description TEXT,
    status public.journal_status_v2 DEFAULT 'draft',
    journal_entry_id UUID REFERENCES public.journal_entries_v2(id),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 5. TRIGGER FUNCTIONS (AUTOMATION)
-- =============================================================================

-- 5.1 Update Balances on Post
CREATE OR REPLACE FUNCTION public.update_account_balances_v2()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'posted' AND OLD.status != 'posted' THEN
        -- Recalculate balances for affecting accounts
        UPDATE public.accounts_v2 a
        SET current_balance = current_balance + (
            SELECT COALESCE(SUM(
                CASE 
                    WHEN at.normal_balance = 'debit' THEN (jl.debit - jl.credit)
                    ELSE (jl.credit - jl.debit)
                END
            ), 0)
            FROM public.journal_lines_v2 jl
            JOIN public.account_types_v2 at ON a.type_id = at.id
            WHERE jl.journal_id = NEW.id AND jl.account_id = a.id
        )
        WHERE id IN (SELECT account_id FROM public.journal_lines_v2 WHERE journal_id = NEW.id);
        
        NEW.posted_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_balances_v2
    BEFORE UPDATE ON public.journal_entries_v2
    FOR EACH ROW
    EXECUTE FUNCTION public.update_account_balances_v2();


-- 5.2 Auto-Create Journal for Receipt
CREATE OR REPLACE FUNCTION public.create_receipt_journal_v2()
RETURNS TRIGGER AS $$
DECLARE
    v_journal_id UUID;
    v_entry_num TEXT;
BEGIN
    IF NEW.status = 'posted' AND OLD.status != 'posted' THEN
        -- Create Header
        v_entry_num := 'JE-' || NEW.receipt_number;
        INSERT INTO public.journal_entries_v2 (
            entry_number, date, description, status, source_type, source_id, total_debit, total_credit
        ) VALUES (
            v_entry_num, NEW.date, 'Receipt: ' || NEW.description, 'posted', 'receipt', NEW.id, NEW.amount, NEW.amount
        ) RETURNING id INTO v_journal_id;
        
        -- Debit Treasury (Cash Increase)
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description)
        VALUES (v_journal_id, NEW.treasury_account_id, NEW.amount, 0, NEW.description);
        
        -- Credit Customer (Receivable Decrease) or Income
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description)
        VALUES (v_journal_id, NEW.customer_account_id, 0, NEW.amount, NEW.description);
        
        -- Link back
        UPDATE public.receipts_v2 SET journal_entry_id = v_journal_id WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_receipt_journal_v2
    AFTER UPDATE ON public.receipts_v2
    FOR EACH ROW
    EXECUTE FUNCTION public.create_receipt_journal_v2();

-- 5.3 Auto-Create Journal for Payment
CREATE OR REPLACE FUNCTION public.create_payment_journal_v2()
RETURNS TRIGGER AS $$
DECLARE
    v_journal_id UUID;
    v_entry_num TEXT;
BEGIN
    IF NEW.status = 'posted' AND OLD.status != 'posted' THEN
        v_entry_num := 'JE-' || NEW.payment_number;
        INSERT INTO public.journal_entries_v2 (
            entry_number, date, description, status, source_type, source_id, total_debit, total_credit
        ) VALUES (
            v_entry_num, NEW.date, 'Payment: ' || NEW.description, 'posted', 'payment', NEW.id, NEW.amount, NEW.amount
        ) RETURNING id INTO v_journal_id;
        
        -- Debit Supplier (Payable Decrease) or Expense
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description)
        VALUES (v_journal_id, NEW.supplier_account_id, NEW.amount, 0, NEW.description);
        
        -- Credit Treasury (Cash Decrease)
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description)
        VALUES (v_journal_id, NEW.treasury_account_id, 0, NEW.amount, NEW.description);
        
        -- Link back
        UPDATE public.payments_v2 SET journal_entry_id = v_journal_id WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_payment_journal_v2
    AFTER UPDATE ON public.payments_v2
    FOR EACH ROW
    EXECUTE FUNCTION public.create_payment_journal_v2();


COMMIT;
