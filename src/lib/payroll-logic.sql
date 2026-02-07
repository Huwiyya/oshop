-- ============================================
-- Payroll System Refactoring - Schema Update
-- ============================================

-- 1. Add is_draft column to payroll_slips
ALTER TABLE payroll_slips ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT TRUE;

-- 2. Create payroll_slip_lines table
CREATE TABLE IF NOT EXISTS payroll_slip_lines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    slip_id TEXT NOT NULL REFERENCES payroll_slips(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    description TEXT,
    amount DECIMAL(19,4) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('earning', 'deduction')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Sequentially Generated Slip Number Function
CREATE OR REPLACE FUNCTION generate_payroll_slip_number() 
RETURNS TEXT AS $$
DECLARE
    year_val TEXT;
    next_val INT;
    new_slip_no TEXT;
BEGIN
    year_val := to_char(NOW(), 'YYYY');
    
    SELECT COALESCE(COUNT(*), 0) + 1 INTO next_val 
    FROM payroll_slips 
    WHERE slip_number LIKE 'PAY-' || year_val || '-%';
    
    new_slip_no := 'PAY-' || year_val || '-' || LPAD(next_val::text, 4, '0');
    RETURN new_slip_no;
END;
$$ LANGUAGE plpgsql;

-- 4. Atomic RPC for creating/updating payroll slips
CREATE OR REPLACE FUNCTION create_payroll_slip_rpc(
    p_slip_id TEXT, -- If NULL, create new. If provided, update existing.
    p_employee_id TEXT,
    p_employee_name TEXT,
    p_period_month INTEGER,
    p_period_year INTEGER,
    p_basic_salary DECIMAL,
    p_net_salary DECIMAL,
    p_is_draft BOOLEAN,
    p_lines JSONB, -- Array of {accountId, description, amount, type}
    p_payment_date DATE DEFAULT CURRENT_DATE
)
RETURNS TEXT AS $func$
DECLARE
    v_slip_id TEXT := p_slip_id;
    v_slip_number TEXT;
    v_line JSONB;
BEGIN
    -- A. Handle Slip Header
    IF v_slip_id IS NULL THEN
        v_slip_number := generate_payroll_slip_number();
        
        INSERT INTO payroll_slips (
            slip_number,
            employee_id,
            employee_name,
            period_month,
            period_year,
            basic_salary, -- Keep for legacy/compat
            net_salary,
            is_draft,
            payment_status,
            created_at
        ) VALUES (
            v_slip_number,
            p_employee_id,
            p_employee_name,
            p_period_month,
            p_period_year,
            p_basic_salary,
            p_net_salary,
            p_is_draft,
            'unpaid',
            NOW()
        ) RETURNING id INTO v_slip_id;
    ELSE
        -- Update existing (only if draft)
        UPDATE payroll_slips SET
            employee_id = p_employee_id,
            employee_name = p_employee_name,
            period_month = p_period_month,
            period_year = p_period_year,
            basic_salary = p_basic_salary,
            net_salary = p_net_salary,
            is_draft = p_is_draft,
            updated_at = NOW()
        WHERE id = v_slip_id AND is_draft = TRUE;
        
        -- Delete old lines
        DELETE FROM payroll_slip_lines WHERE slip_id = v_slip_id;
    END IF;

    -- B. Insert Lines
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        INSERT INTO payroll_slip_lines (
            slip_id,
            account_id,
            description,
            amount,
            type
        ) VALUES (
            v_slip_id,
            v_line->>'accountId',
            v_line->>'description',
            (v_line->>'amount')::DECIMAL,
            v_line->>'type'
        );
    END LOOP;

    RETURN v_slip_id;
END;
$func$ LANGUAGE plpgsql;
