-- Add 'details' column to payroll_slips for flexible earnings/deductions
ALTER TABLE payroll_slips ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '[]'::jsonb;
