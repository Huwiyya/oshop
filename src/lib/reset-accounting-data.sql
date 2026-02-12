-- ==========================================
-- Reset Accounting Data (Keep Customers/COA)
-- ==========================================
-- This script deletes all transactional data and inventory items.
-- It PRESERVES the 'accounts' table (which contains Customers, Suppliers, and the Chart of Accounts).

BEGIN;

-- 1. Disable triggers to speed up deletion and avoid side effects
SET session_replication_role = 'replica';

-- 2. Truncate Transaction Tables (Order matters for some FKs, but CASCADE handles strict ones)
-- Financial Transactions
TRUNCATE TABLE journal_entry_lines, journal_entries RESTART IDENTITY CASCADE;

-- Invoices
TRUNCATE TABLE purchase_invoice_lines, purchase_invoices RESTART IDENTITY CASCADE;
TRUNCATE TABLE sales_invoice_lines, sales_invoices RESTART IDENTITY CASCADE;

-- Inventory
TRUNCATE TABLE inventory_transactions RESTART IDENTITY CASCADE;
TRUNCATE TABLE inventory_layers RESTART IDENTITY CASCADE;
TRUNCATE TABLE inventory_items RESTART IDENTITY CASCADE;

-- Payroll
TRUNCATE TABLE payroll_slip_lines, payroll_slips RESTART IDENTITY CASCADE;

-- Treasury / Fixed Assets (if exist)
TRUNCATE TABLE treasury_transactions_v4 RESTART IDENTITY CASCADE;
TRUNCATE TABLE fixed_assets RESTART IDENTITY CASCADE;

-- 3. Reset Sequences (Optional, handled by RESTART IDENTITY mostly)
-- 4. Re-enable triggers
SET session_replication_role = 'origin';

COMMIT;

SELECT 'All accounting data (Transactions, Invoices, Inventory Items) has been deleted. Customers and Accounts are preserved.' as status;
