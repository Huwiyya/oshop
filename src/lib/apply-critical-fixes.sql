-- ============================================
-- Critical Fixes - All in One Script
-- ============================================
-- Purpose: Apply all critical fixes to the accounting system
-- Date: 2026-02-09
-- Version: 1.0
--
-- This script includes:
-- 1. System Accounts Table
-- 2. Fiscal Period Locking
-- 3. Tax Support for Invoices
-- ============================================

-- ============================================
-- PART 1: System Accounts Table
-- ============================================

CREATE TABLE IF NOT EXISTS system_accounts (
    key TEXT PRIMARY KEY,
    account_id TEXT REFERENCES accounts(id) NOT NULL,
    description TEXT,
    is_locked BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_accounts_account_id ON system_accounts(account_id);

-- Insert core system account mappings
INSERT INTO system_accounts (key, account_id, description, is_locked)
SELECT 
    'CUSTOMERS_CONTROL',
    id,
    'Accounts Receivable - Customers Control Account',
    TRUE
FROM accounts WHERE account_code = '1120'
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_accounts (key, account_id, description, is_locked)
SELECT 
    'SUPPLIERS_CONTROL',
    id,
    'Accounts Payable - Suppliers Control Account',
    TRUE
FROM accounts WHERE account_code = '2110'
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_accounts (key, account_id, description, is_locked)
SELECT 
    'EMPLOYEES_PAYABLE',
    id,
    'Salaries and Wages Payable - Employees Control Account',
    TRUE
FROM accounts WHERE account_code = '2130'
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_accounts (key, account_id, description, is_locked)
SELECT 
    'INVENTORY_ASSET',
    id,
    'General Inventory Asset Account (Level 4)',
    TRUE
FROM accounts WHERE account_code = '113001'
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_accounts (key, account_id, description, is_locked)
SELECT 
    'SALES_REVENUE',
    id,
    'General Sales Revenue Account (Level 4)',
    TRUE
FROM accounts WHERE account_code = '410001'
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_accounts (key, account_id, description, is_locked)
SELECT 
    'COGS_EXPENSE',
    id,
    'Cost of Goods Sold Account (Level 4)',
    TRUE
FROM accounts WHERE account_code = '510001'
ON CONFLICT (key) DO NOTHING;

-- Helper function to get system account ID
CREATE OR REPLACE FUNCTION get_system_account(p_key TEXT)
RETURNS TEXT AS $$
DECLARE
    v_account_id TEXT;
BEGIN
    SELECT account_id INTO v_account_id
    FROM system_accounts
    WHERE key = p_key;
    
    IF v_account_id IS NULL THEN
        RAISE EXCEPTION 'System account not found: %', p_key;
    END IF;
    
    RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- Prevent deletion/update of locked system accounts
CREATE OR REPLACE FUNCTION protect_system_accounts()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_locked = TRUE THEN
        RAISE EXCEPTION 'Cannot modify or delete locked system account: %', OLD.key;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_system_account_changes ON system_accounts;
CREATE TRIGGER prevent_system_account_changes
BEFORE UPDATE OR DELETE ON system_accounts
FOR EACH ROW
EXECUTE FUNCTION protect_system_accounts();

-- ============================================
-- PART 2: Fiscal Period Locking
-- ============================================

CREATE TABLE IF NOT EXISTS fiscal_periods (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    period_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    closed_by TEXT,
    closed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(start_date, end_date),
    CHECK (end_date >= start_date)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_dates ON fiscal_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_closed ON fiscal_periods(is_closed);

-- Function to check if a date falls in a closed period
CREATE OR REPLACE FUNCTION is_period_closed(p_date DATE)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_closed BOOLEAN;
BEGIN
    SELECT is_closed INTO v_is_closed
    FROM fiscal_periods
    WHERE p_date BETWEEN start_date AND end_date
    AND is_closed = TRUE
    LIMIT 1;
    
    RETURN COALESCE(v_is_closed, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Trigger function to prevent journal entry changes in closed periods
CREATE OR REPLACE FUNCTION check_period_lock()
RETURNS TRIGGER AS $$
DECLARE
    v_is_closed BOOLEAN;
BEGIN
    -- For DELETE, check OLD date
    IF (TG_OP = 'DELETE') THEN
        v_is_closed := is_period_closed(OLD.entry_date);
        IF v_is_closed THEN
            RAISE EXCEPTION 'لا يمكن حذف قيد محاسبي من فترة مغلقة (تاريخ القيد: %)', OLD.entry_date;
        END IF;
        RETURN OLD;
    END IF;
    
    -- For INSERT/UPDATE, check NEW date
    v_is_closed := is_period_closed(NEW.entry_date);
    IF v_is_closed THEN
        IF (TG_OP = 'INSERT') THEN
            RAISE EXCEPTION 'لا يمكن إضافة قيد محاسبي في فترة مغلقة (تاريخ القيد: %)', NEW.entry_date;
        ELSIF (TG_OP = 'UPDATE') THEN
            RAISE EXCEPTION 'لا يمكن تعديل قيد محاسبي في فترة مغلقة (تاريخ القيد: %)', NEW.entry_date;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to journal_entries
DROP TRIGGER IF EXISTS check_journal_entry_period ON journal_entries;
CREATE TRIGGER check_journal_entry_period
BEFORE INSERT OR UPDATE OR DELETE ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION check_period_lock();

-- Function to close a fiscal period
CREATE OR REPLACE FUNCTION close_fiscal_period(
    p_period_id TEXT,
    p_closed_by TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_period RECORD;
BEGIN
    SELECT * INTO v_period
    FROM fiscal_periods
    WHERE id = p_period_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Fiscal period not found';
    END IF;
    
    IF v_period.is_closed THEN
        RAISE EXCEPTION 'Period already closed';
    END IF;
    
    UPDATE fiscal_periods
    SET is_closed = TRUE,
        closed_by = p_closed_by,
        closed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_period_id;
    
    RAISE NOTICE 'Fiscal period "%" closed successfully', v_period.period_name;
END;
$$ LANGUAGE plpgsql;

-- Function to reopen a fiscal period
CREATE OR REPLACE FUNCTION reopen_fiscal_period(p_period_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE fiscal_periods
    SET is_closed = FALSE,
        closed_by = NULL,
        closed_at = NULL,
        updated_at = NOW()
    WHERE id = p_period_id;
    
    RAISE WARNING '⚠️ Fiscal period reopened. Use with caution!';
END;
$$ LANGUAGE plpgsql;

-- Insert fiscal periods for 2026
DO $$
DECLARE
    v_month INTEGER;
    v_year INTEGER := 2026;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    FOR v_month IN 1..12 LOOP
        v_start_date := make_date(v_year, v_month, 1);
        v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
        
        INSERT INTO fiscal_periods (period_name, start_date, end_date, is_closed)
        VALUES (
            to_char(v_start_date, 'Month YYYY'),
            v_start_date,
            v_end_date,
            FALSE
        )
        ON CONFLICT (start_date, end_date) DO NOTHING;
    END LOOP;
    
    RAISE NOTICE '✓ Created 12 monthly fiscal periods for 2026';
END $$;

-- ============================================
-- PART 3: Tax Support
-- ============================================

-- Add Tax columns to sales_invoices
ALTER TABLE sales_invoices 
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(19,4) DEFAULT 0;

-- Update existing sales invoices to set subtotal if NULL
UPDATE sales_invoices 
SET subtotal = COALESCE(subtotal, total_amount)
WHERE subtotal IS NULL;

-- Add Tax columns to purchase_invoices
ALTER TABLE purchase_invoices 
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(19,4) DEFAULT 0;

-- Update existing purchase invoices
UPDATE purchase_invoices 
SET subtotal = COALESCE(subtotal, total_amount)
WHERE subtotal IS NULL;

-- Helper function to calculate invoice totals with tax
CREATE OR REPLACE FUNCTION calculate_invoice_total(
    p_subtotal DECIMAL(19,4),
    p_discount_percentage DECIMAL(5,2) DEFAULT 0,
    p_tax_rate DECIMAL(5,2) DEFAULT 0
) RETURNS TABLE (
    subtotal DECIMAL(19,4),
    discount_amount DECIMAL(19,4),
    amount_after_discount DECIMAL(19,4),
    tax_amount DECIMAL(19,4),
    total_amount DECIMAL(19,4)
) AS $$
DECLARE
    v_discount_amount DECIMAL(19,4);
    v_after_discount DECIMAL(19,4);
    v_tax_amount DECIMAL(19,4);
    v_total DECIMAL(19,4);
BEGIN
    -- Calculate discount
    v_discount_amount := p_subtotal * (p_discount_percentage / 100);
    v_after_discount := p_subtotal - v_discount_amount;
    
    -- Calculate tax on amount after discount
    v_tax_amount := v_after_discount * (p_tax_rate / 100);
    
    -- Calculate total
    v_total := v_after_discount + v_tax_amount;
    
    RETURN QUERY SELECT 
        p_subtotal,
        v_discount_amount,
        v_after_discount,
        v_tax_amount,
        v_total;
END;
$$ LANGUAGE plpgsql;

-- Create tax_rates configuration table
CREATE TABLE IF NOT EXISTS tax_rates (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    rate DECIMAL(5,2) NOT NULL CHECK (rate >= 0 AND rate <= 100),
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert common tax rates
INSERT INTO tax_rates (name_ar, name_en, rate, is_default, description)
VALUES 
    ('بدون ضريبة', 'No Tax', 0, TRUE, 'Default - No Tax Applied'),
    ('ضريبة القيمة المضافة', 'VAT', 14, FALSE, 'Value Added Tax (if applicable)')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- VERIFICATION & SUMMARY
-- ============================================

DO $$
DECLARE
    v_system_accounts_count INTEGER;
    v_fiscal_periods_count INTEGER;
    v_tax_rates_count INTEGER;
BEGIN
    -- Check system_accounts
    SELECT COUNT(*) INTO v_system_accounts_count FROM system_accounts;
    
    -- Check fiscal_periods
    SELECT COUNT(*) INTO v_fiscal_periods_count FROM fiscal_periods;
    
    -- Check tax_rates
    SELECT COUNT(*) INTO v_tax_rates_count FROM tax_rates;
    
    RAISE NOTICE '';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'CRITICAL FIXES APPLIED SUCCESSFULLY';
    RAISE NOTICE '====================================';
    RAISE NOTICE '';
    RAISE NOTICE '✓ System Accounts Table: % mappings created', v_system_accounts_count;
    RAISE NOTICE '✓ Fiscal Periods: % periods created', v_fiscal_periods_count;
    RAISE NOTICE '✓ Tax Rates: % rates configured', v_tax_rates_count;
    RAISE NOTICE '✓ Tax columns added to sales_invoices';
    RAISE NOTICE '✓ Tax columns added to purchase_invoices';
    RAISE NOTICE '✓ Helper functions created';
    RAISE NOTICE '✓ Triggers activated';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '1. Update TypeScript code to use new features';
    RAISE NOTICE '2. Create UI for fiscal period management';
    RAISE NOTICE '3. Update invoice forms to support tax';
    RAISE NOTICE '';
END $$;
