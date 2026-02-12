-- =============================================================================
-- FINAL ACCOUNTING SYSTEM V3 - COMPLETE CONSOLIDATED SCHEMA
-- =============================================================================
-- This script installs the complete V3 Accounting System.
-- It includes EVERYTHING from V2 plus the latest Treasury upgrades (Split Payments).
-- 
-- 1. Core Config & Types
-- 2. Chart of Accounts (COA)
-- 3. General Ledger (Journal Entries)
-- 4. Treasury (Receipts & Payments with Multi-Line Support)
-- 5. Commercial (Sales & Purchase Invoices)
-- 6. Payroll
-- 7. Fixed Assets
-- 8. Inventory (with FIFO & Listings)
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. CLEANUP (FRESH START)
-- =============================================================================

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS public.inventory_transactions_v2 CASCADE;
DROP TABLE IF EXISTS public.inventory_layers_v2 CASCADE;
DROP TABLE IF EXISTS public.purchase_invoice_lines_v2 CASCADE;
DROP TABLE IF EXISTS public.sales_invoice_lines_v2 CASCADE;
DROP TABLE IF EXISTS public.purchase_invoices_v2 CASCADE;
DROP TABLE IF EXISTS public.sales_invoices_v2 CASCADE;
DROP TABLE IF EXISTS public.products_v2 CASCADE;

DROP TABLE IF EXISTS public.depreciation_entries_v2 CASCADE;
DROP TABLE IF EXISTS public.fixed_assets_v2 CASCADE;

DROP TABLE IF EXISTS public.payroll_items_v2 CASCADE;
DROP TABLE IF EXISTS public.payroll_runs_v2 CASCADE;

DROP TABLE IF EXISTS public.payment_lines_v2 CASCADE;
DROP TABLE IF EXISTS public.receipt_lines_v2 CASCADE;
DROP TABLE IF EXISTS public.payments_v2 CASCADE;
DROP TABLE IF EXISTS public.receipts_v2 CASCADE;

DROP TABLE IF EXISTS public.journal_lines_v2 CASCADE;
DROP TABLE IF EXISTS public.journal_entries_v2 CASCADE;

DROP TABLE IF EXISTS public.accounts_v2 CASCADE;
DROP TABLE IF EXISTS public.account_types_v2 CASCADE;

-- Drop System Tables
DROP TABLE IF EXISTS public.managers_v4 CASCADE;
DROP TABLE IF EXISTS public.system_settings_v4 CASCADE;
DROP TABLE IF EXISTS public.users_v4 CASCADE;

-- Drop Types
DROP TYPE IF EXISTS public.account_category_v2 CASCADE;
DROP TYPE IF EXISTS public.normal_balance_v2 CASCADE;
DROP TYPE IF EXISTS public.journal_status_v2 CASCADE;

-- =============================================================================
-- 2. SYSTEM CORE (LOGIN & SETTINGS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.managers_v4 (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    phone TEXT,
    permissions TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default Admin
INSERT INTO public.managers_v4 (id, name, username, password, phone, permissions)
VALUES (
    'admin@Oshop.app', 
    'المدير العام', 
    'admin@Oshop.app', 
    '0920064400', 
    '0920064400', 
    ARRAY['dashboard', 'users', 'employees', 'representatives', 'orders', 'inventory', 'shipping_label', 'temporary_users', 'financial_reports', 'instant_sales', 'deposits', 'expenses', 'creditors', 'support', 'notifications', 'exchange_rate', 'data_export']
) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.system_settings_v4 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "exchangeRate" DECIMAL(10, 4) DEFAULT 5.0,
    "shippingExchangeRate" DECIMAL(10, 4) DEFAULT 5.0,
    "shippingCostUSD" DECIMAL(10, 4) DEFAULT 4.5,
    "shippingPriceUSD" DECIMAL(10, 4) DEFAULT 5.0,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default Settings
INSERT INTO public.system_settings_v4 ("exchangeRate", "shippingExchangeRate", "shippingCostUSD", "shippingPriceUSD")
VALUES (5.0, 5.0, 4.5, 5.0);

CREATE TABLE IF NOT EXISTS public.users_v4 (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT,
    phone TEXT,
    "orderCount" INTEGER DEFAULT 0,
    debt DECIMAL(20, 4) DEFAULT 0,
    "walletBalance" DECIMAL(20, 4) DEFAULT 0,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 3. CORE TYPES & CONFIGURATION (ACCOUNTING)
-- =============================================================================

CREATE TYPE public.account_category_v2 AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

CREATE TYPE public.normal_balance_v2 AS ENUM ('debit', 'credit');

CREATE TYPE public.journal_status_v2 AS ENUM ('draft', 'posted', 'archived', 'cancelled');

-- =============================================================================
-- 4. CHART OF ACCOUNTS
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
    type_id UUID NOT NULL REFERENCES public.account_types_v2(id),
    parent_id UUID REFERENCES public.accounts_v2(id),
    level INTEGER NOT NULL,
    is_group BOOLEAN DEFAULT FALSE,
    current_balance DECIMAL(20, 4) DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 3. GENERAL LEDGER
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.journal_entries_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    status public.journal_status_v2 DEFAULT 'draft',
    source_type TEXT,
    source_id UUID,
    total_debit DECIMAL(20, 4) DEFAULT 0,
    total_credit DECIMAL(20, 4) DEFAULT 0,
    posted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.journal_lines_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_id UUID NOT NULL REFERENCES public.journal_entries_v2(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts_v2(id),
    debit DECIMAL(20, 4) DEFAULT 0,
    credit DECIMAL(20, 4) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger: Update Account Balances
CREATE OR REPLACE FUNCTION public.update_account_balances_v2()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'posted' AND OLD.status != 'posted' THEN
        UPDATE public.accounts_v2 a
        SET current_balance = current_balance + (
            SELECT COALESCE(SUM(
                CASE WHEN at.normal_balance = 'debit' THEN (jl.debit - jl.credit)
                     ELSE (jl.credit - jl.debit) END
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

DROP TRIGGER IF EXISTS trg_update_balances_v2 ON public.journal_entries_v2;
CREATE TRIGGER trg_update_balances_v2 BEFORE UPDATE ON public.journal_entries_v2 FOR EACH ROW EXECUTE FUNCTION public.update_account_balances_v2();

-- =============================================================================
-- 4. TREASURY (RECEIPTS & PAYMENTS) - UPGRADED V3
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.receipts_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL,
    customer_account_id UUID REFERENCES public.accounts_v2(id),
    treasury_account_id UUID REFERENCES public.accounts_v2(id),
    amount DECIMAL(20, 4) NOT NULL,
    description TEXT,
    status public.journal_status_v2 DEFAULT 'draft',
    journal_entry_id UUID REFERENCES public.journal_entries_v2(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.receipt_lines_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_id UUID NOT NULL REFERENCES public.receipts_v2(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts_v2(id),
    amount DECIMAL(20, 4) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL,
    supplier_account_id UUID REFERENCES public.accounts_v2(id),
    treasury_account_id UUID REFERENCES public.accounts_v2(id),
    amount DECIMAL(20, 4) NOT NULL,
    description TEXT,
    status public.journal_status_v2 DEFAULT 'draft',
    journal_entry_id UUID REFERENCES public.journal_entries_v2(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_lines_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES public.payments_v2(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts_v2(id),
    amount DECIMAL(20, 4) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4.1 Payment Journal Trigger (Multi-Line Support)
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
        -- Option B: Fallback for Legacy/Simple Payments
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

DROP TRIGGER IF EXISTS trg_create_payment_journal_v2 ON public.payments_v2;
CREATE TRIGGER trg_create_payment_journal_v2 AFTER UPDATE ON public.payments_v2 FOR EACH ROW EXECUTE FUNCTION public.create_payment_journal_v2();

-- 4.2 Receipt Journal Trigger (Multi-Line Support)
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

DROP TRIGGER IF EXISTS trg_create_receipt_journal_v2 ON public.receipts_v2;
CREATE TRIGGER trg_create_receipt_journal_v2 AFTER UPDATE ON public.receipts_v2 FOR EACH ROW EXECUTE FUNCTION public.create_receipt_journal_v2();

-- =============================================================================
-- 5. COMMERCIAL (INVOICES)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sales_invoices_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL,
    customer_account_id UUID NOT NULL REFERENCES public.accounts_v2(id),
    revenue_account_id UUID NOT NULL REFERENCES public.accounts_v2(id),
    amount DECIMAL(20, 4) NOT NULL,
    tax_amount DECIMAL(20, 4) DEFAULT 0,
    total_amount DECIMAL(20, 4) GENERATED ALWAYS AS (amount + tax_amount) STORED,
    description TEXT,
    status public.journal_status_v2 DEFAULT 'draft',
    journal_entry_id UUID REFERENCES public.journal_entries_v2(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

CREATE TABLE IF NOT EXISTS public.purchase_invoices_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL,
    supplier_account_id UUID NOT NULL REFERENCES public.accounts_v2(id),
    expense_account_id UUID NOT NULL REFERENCES public.accounts_v2(id),
    amount DECIMAL(20, 4) NOT NULL,
    tax_amount DECIMAL(20, 4) DEFAULT 0,
    total_amount DECIMAL(20, 4) GENERATED ALWAYS AS (amount + tax_amount) STORED,
    description TEXT,
    status public.journal_status_v2 DEFAULT 'draft',
    journal_entry_id UUID REFERENCES public.journal_entries_v2(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 6. INVENTORY
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.products_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    type TEXT DEFAULT 'product',
    inventory_account_id UUID REFERENCES public.accounts_v2(id),
    cogs_account_id UUID REFERENCES public.accounts_v2(id),
    sales_account_id UUID REFERENCES public.accounts_v2(id),
    current_quantity DECIMAL(20, 4) DEFAULT 0,
    average_cost DECIMAL(20, 4) DEFAULT 0,
    -- UI Fields
    min_stock_level INTEGER DEFAULT 0,
    selling_price_lyd DECIMAL(20, 4) DEFAULT 0,
    selling_price_usd DECIMAL(20, 4) DEFAULT 0,
    description TEXT,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_invoice_lines_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES public.purchase_invoices_v2(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products_v2(id),
    description TEXT,
    quantity DECIMAL(20, 4) DEFAULT 1,
    unit_price DECIMAL(20, 4) DEFAULT 0,
    line_total DECIMAL(20, 4) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE TABLE IF NOT EXISTS public.inventory_layers_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products_v2(id),
    date DATE NOT NULL,
    quantity DECIMAL(20, 4) NOT NULL,
    remaining_quantity DECIMAL(20, 4) NOT NULL,
    unit_cost DECIMAL(20, 4) NOT NULL,
    source_type TEXT,
    source_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_transactions_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products_v2(id),
    date DATE NOT NULL,
    transaction_type TEXT NOT NULL,
    quantity DECIMAL(20, 4) NOT NULL,
    unit_cost DECIMAL(20, 4) NOT NULL,
    source_type TEXT,
    source_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 7. FIXED ASSETS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fixed_assets_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_number TEXT NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    acquisition_date DATE NOT NULL,
    cost DECIMAL(20, 4) NOT NULL,
    accumulated_depreciation DECIMAL(20, 4) DEFAULT 0,
    asset_account_id UUID REFERENCES public.accounts_v2(id),
    accumulated_depreciation_account_id UUID REFERENCES public.accounts_v2(id),
    depreciation_expense_account_id UUID REFERENCES public.accounts_v2(id),
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.depreciation_entries_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES public.fixed_assets_v2(id),
    date DATE NOT NULL,
    amount DECIMAL(20, 4) NOT NULL,
    status public.journal_status_v2 DEFAULT 'draft',
    journal_entry_id UUID REFERENCES public.journal_entries_v2(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 8. PAYROLL
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.payroll_runs_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL,
    month TEXT NOT NULL,
    total_gross DECIMAL(20, 4) DEFAULT 0,
    total_deductions DECIMAL(20, 4) DEFAULT 0,
    total_net DECIMAL(20, 4) GENERATED ALWAYS AS (total_gross - total_deductions) STORED,
    payment_account_id UUID REFERENCES public.accounts_v2(id),
    expense_account_id UUID REFERENCES public.accounts_v2(id),
    status public.journal_status_v2 DEFAULT 'draft',
    journal_entry_id UUID REFERENCES public.journal_entries_v2(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_items_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs_v2(id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    basic_salary DECIMAL(20, 4) DEFAULT 0,
    allowances DECIMAL(20, 4) DEFAULT 0,
    deductions DECIMAL(20, 4) DEFAULT 0,
    bonuses DECIMAL(20, 4) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 9. TRIGGERS - COMMERCIAL & INVENTORY (CRITICAL ORDERING)
-- =============================================================================

-- 9.1 Purchase Inventory Trigger
CREATE OR REPLACE FUNCTION public.process_purchase_inventory_v2() RETURNS TRIGGER AS $$
DECLARE v_line RECORD;
BEGIN
    IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
        FOR v_line IN SELECT * FROM public.purchase_invoice_lines_v2 WHERE invoice_id = NEW.id LOOP
            IF v_line.product_id IS NOT NULL THEN
                INSERT INTO public.inventory_layers_v2 (product_id, date, quantity, remaining_quantity, unit_cost, source_type, source_id)
                VALUES (v_line.product_id, NEW.date, v_line.quantity, v_line.quantity, v_line.unit_price, 'purchase_invoice', NEW.id);
                
                INSERT INTO public.inventory_transactions_v2 (product_id, date, transaction_type, quantity, unit_cost, source_type, source_id)
                VALUES (v_line.product_id, NEW.date, 'purchase', v_line.quantity, v_line.unit_price, 'purchase_invoice', NEW.id);
                
                UPDATE public.products_v2 SET current_quantity = current_quantity + v_line.quantity WHERE id = v_line.product_id;
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_process_purchase_inventory_v2 ON public.purchase_invoices_v2;
CREATE TRIGGER trg_process_purchase_inventory_v2 AFTER UPDATE ON public.purchase_invoices_v2 FOR EACH ROW EXECUTE FUNCTION public.process_purchase_inventory_v2();

-- 9.2 Purchase Journal Trigger
CREATE OR REPLACE FUNCTION public.create_purchase_journal_v2() RETURNS TRIGGER AS $$
DECLARE v_jid UUID;
BEGIN
    IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
        INSERT INTO public.journal_entries_v2 (entry_number, date, description, status, source_type, source_id, total_debit, total_credit)
        VALUES ('BILL-'||NEW.invoice_number, NEW.date, 'Bill: '||NEW.description, 'posted', 'purchase_invoice', NEW.id, NEW.total_amount, NEW.total_amount) RETURNING id INTO v_jid;
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description) VALUES (v_jid, NEW.expense_account_id, NEW.total_amount, 0, 'Purchase Expense');
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description) VALUES (v_jid, NEW.supplier_account_id, 0, NEW.total_amount, 'Bill Payable');
        UPDATE public.purchase_invoices_v2 SET journal_entry_id = v_jid WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_purchase_journal_v2 ON public.purchase_invoices_v2;
CREATE TRIGGER trg_create_purchase_journal_v2 AFTER UPDATE ON public.purchase_invoices_v2 FOR EACH ROW EXECUTE FUNCTION public.create_purchase_journal_v2();


-- 9.3 Sales Inventory Trigger (RENAMED TO FORCE PRIORITY)
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
                
                FOR v_layer IN SELECT * FROM public.inventory_layers_v2 WHERE product_id = v_line.product_id AND remaining_quantity > 0 ORDER BY date ASC, created_at ASC LOOP
                    EXIT WHEN v_qty_needed <= 0;
                    IF v_layer.remaining_quantity >= v_qty_needed THEN v_consume := v_qty_needed; ELSE v_consume := v_layer.remaining_quantity; END IF;
                    UPDATE public.inventory_layers_v2 SET remaining_quantity = remaining_quantity - v_consume WHERE id = v_layer.id;
                    v_line_cogs := v_line_cogs + (v_consume * v_layer.unit_cost);
                    v_qty_needed := v_qty_needed - v_consume;
                END LOOP;

                INSERT INTO public.inventory_transactions_v2 (product_id, date, transaction_type, quantity, unit_cost, source_type, source_id)
                VALUES (v_line.product_id, NEW.date, 'sale', -v_line.quantity, CASE WHEN v_line.quantity > 0 THEN v_line_cogs / v_line.quantity ELSE 0 END, 'sales_invoice', NEW.id);
                
                UPDATE public.products_v2 SET current_quantity = current_quantity - v_line.quantity WHERE id = v_line.product_id;
            END IF;
        END LOOP;
    END IF;

    -- Part 2: COGS Journal Lines (Depends on Part 1 data)
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

-- Rename to 'a_' to ensure it runs BEFORE trg_create_sales_journal_v2
DROP TRIGGER IF EXISTS trg_process_sales_inventory_v2 ON public.sales_invoices_v2;
DROP TRIGGER IF EXISTS a_trg_process_sales_inventory_v2 ON public.sales_invoices_v2; 
CREATE TRIGGER a_trg_process_sales_inventory_v2 AFTER UPDATE ON public.sales_invoices_v2 FOR EACH ROW EXECUTE FUNCTION public.process_sales_inventory_v2();

-- 9.4 Sales Journal Trigger
CREATE OR REPLACE FUNCTION public.create_sales_journal_v2() RETURNS TRIGGER AS $$
DECLARE v_jid UUID;
BEGIN
    IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
        INSERT INTO public.journal_entries_v2 (entry_number, date, description, status, source_type, source_id, total_debit, total_credit)
        VALUES ('INV-'||NEW.invoice_number, NEW.date, 'Invoice: '||NEW.description, 'posted', 'sales_invoice', NEW.id, NEW.total_amount, NEW.total_amount) RETURNING id INTO v_jid;
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description) VALUES (v_jid, NEW.customer_account_id, NEW.total_amount, 0, 'Receivable');
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description) VALUES (v_jid, NEW.revenue_account_id, 0, NEW.amount, 'Revenue');
        UPDATE public.sales_invoices_v2 SET journal_entry_id = v_jid WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_sales_journal_v2 ON public.sales_invoices_v2;
CREATE TRIGGER trg_create_sales_journal_v2 AFTER UPDATE ON public.sales_invoices_v2 FOR EACH ROW EXECUTE FUNCTION public.create_sales_journal_v2();

-- 9.5 Fixed Assets Depreciation Trigger
CREATE OR REPLACE FUNCTION public.create_depreciation_journal_v2() RETURNS TRIGGER AS $$
DECLARE v_jid UUID; v_asset RECORD;
BEGIN
    IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
        SELECT * INTO v_asset FROM public.fixed_assets_v2 WHERE id = NEW.asset_id;
        INSERT INTO public.journal_entries_v2 (entry_number, date, description, status, source_type, source_id, total_debit, total_credit)
        VALUES ('DEP-'||v_asset.asset_number, NEW.date, 'Depreciation', 'posted', 'depreciation', NEW.id, NEW.amount, NEW.amount) RETURNING id INTO v_jid;
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description) VALUES (v_jid, v_asset.depreciation_expense_account_id, NEW.amount, 0, 'Depreciation');
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description) VALUES (v_jid, v_asset.accumulated_depreciation_account_id, 0, NEW.amount, 'Accum Dep');
        UPDATE public.depreciation_entries_v2 SET journal_entry_id = v_jid WHERE id = NEW.id;
        UPDATE public.fixed_assets_v2 SET accumulated_depreciation = accumulated_depreciation + NEW.amount WHERE id = NEW.asset_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_depreciation_journal_v2 ON public.depreciation_entries_v2;
CREATE TRIGGER trg_create_depreciation_journal_v2 AFTER UPDATE ON public.depreciation_entries_v2 FOR EACH ROW EXECUTE FUNCTION public.create_depreciation_journal_v2();

-- 9.6 Payroll Journal Trigger
CREATE OR REPLACE FUNCTION public.create_payroll_journal_v2() RETURNS TRIGGER AS $$
DECLARE v_jid UUID;
BEGIN
    IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
        INSERT INTO public.journal_entries_v2 (entry_number, date, description, status, source_type, source_id, total_debit, total_credit)
        VALUES ('PAY-'||NEW.run_number, NEW.date, 'Payroll '||NEW.month, 'posted', 'payroll_run', NEW.id, NEW.total_gross, NEW.total_gross) RETURNING id INTO v_jid;
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description) VALUES (v_jid, NEW.expense_account_id, NEW.total_net, 0, 'Salaries Expense');
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description) VALUES (v_jid, NEW.payment_account_id, 0, NEW.total_net, 'Net Payment');
        UPDATE public.payroll_runs_v2 SET journal_entry_id = v_jid WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_payroll_journal_v2 ON public.payroll_runs_v2;
CREATE TRIGGER trg_create_payroll_journal_v2 AFTER UPDATE ON public.payroll_runs_v2 FOR EACH ROW EXECUTE FUNCTION public.create_payroll_journal_v2();

COMMIT;
