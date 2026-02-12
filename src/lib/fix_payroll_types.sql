
-- Fix Payroll Column Types to UUID
-- Run this in Supabase SQL Editor

BEGIN;

-- 1. Fix payroll_slips columns
ALTER TABLE payroll_slips 
    ALTER COLUMN employee_id TYPE UUID USING employee_id::uuid,
    ALTER COLUMN created_by TYPE UUID USING created_by::uuid,
    ALTER COLUMN journal_entry_id TYPE UUID USING journal_entry_id::uuid;

-- 2. Fix payroll_slip_lines columns
ALTER TABLE payroll_slip_lines 
    ALTER COLUMN slip_id TYPE UUID USING slip_id::uuid,
    ALTER COLUMN account_id TYPE UUID USING account_id::uuid;

COMMIT;
