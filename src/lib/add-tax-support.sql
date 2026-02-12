-- ============================================
-- Tax Support for Sales and Purchase Invoices
-- ============================================
-- Purpose: Add tax calculation fields to invoices

-- 1. Add Tax columns to sales_invoices
ALTER TABLE sales_invoices 
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(19,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(19,4),
ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(19,4) DEFAULT 0;

-- Update existing records to set subtotal = total_amount
UPDATE sales_invoices 
SET subtotal = total_amount 
WHERE subtotal IS NULL;

-- 2. Add Tax columns to purchase_invoices
ALTER TABLE purchase_invoices 
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(19,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(

19,4),
ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(19,4) DEFAULT 0;

-- Update existing records
UPDATE purchase_invoices 
SET subtotal = total_amount 
WHERE subtotal IS NULL;

-- 3. Helper function to calculate invoice totals with tax
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

-- 4. Create tax_rates configuration table (optional)
CREATE TABLE IF NOT EXISTS tax_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL,
    name_en TEXT,
    rate DECIMAL(5,2) NOT NULL CHECK (rate >= 0 AND rate <= 100),
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert common tax rates (Libya specific - VAT may not apply, adjust as needed)
INSERT INTO tax_rates (name_ar, name_en, rate, is_default, description)
VALUES 
    ('بدون ضريبة', 'No Tax', 0, TRUE, 'Default - No Tax Applied'),
    ('ضريبة القيمة المضافة', 'VAT', 14, FALSE, 'Value Added Tax (if applicable)')
ON CONFLICT DO NOTHING;

-- 5. Verification
DO $$
BEGIN
    RAISE NOTICE '✓ Tax support added successfully';
    RAISE NOTICE '  - sales_invoices: tax_rate, tax_amount, subtotal, discount columns added';
    RAISE NOTICE '  - purchase_invoices: tax_rate, tax_amount, subtotal, discount columns added';
    RAISE NOTICE '  - Helper function calculate_invoice_total() created';
    RAISE NOTICE '  - tax_rates configuration table created';
END $$;
