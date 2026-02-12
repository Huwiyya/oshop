-- ============================================
-- FIX: Remove Duplicate Account Balance Triggers
-- ============================================
-- The new system relies ONLY on journal_entry_lines to update account balances.
-- We must remove any legacy triggers on document lines (receipts, payments, invoices)
-- that might be redundant and causing double-counting.

-- 1. Receipt Lines
DROP TRIGGER IF EXISTS on_receipt_line_change ON receipt_lines;
DROP TRIGGER IF EXISTS update_account_balance_receipt ON receipt_lines;
DROP TRIGGER IF EXISTS trg_update_balance_receipt ON receipt_lines;

-- 2. Payment Lines
DROP TRIGGER IF EXISTS on_payment_line_change ON payment_lines;
DROP TRIGGER IF EXISTS update_account_balance_payment ON payment_lines;
DROP TRIGGER IF EXISTS trg_update_balance_payment ON payment_lines;

-- 3. Sales Invoice Lines
DROP TRIGGER IF EXISTS on_sales_invoice_line_change ON sales_invoice_lines;
DROP TRIGGER IF EXISTS update_account_balance_sales ON sales_invoice_lines;
DROP TRIGGER IF EXISTS trg_update_balance_sales ON sales_invoice_lines;

-- 4. Purchase Invoice Lines
DROP TRIGGER IF EXISTS on_purchase_invoice_line_change ON purchase_invoice_lines;
DROP TRIGGER IF EXISTS update_account_balance_purchase ON purchase_invoice_lines;
DROP TRIGGER IF EXISTS trg_update_balance_purchase ON purchase_invoice_lines;

-- 5. Accounts (Legacy direct updates)
-- Sometimes triggers are on the header tables? Unlikely for line items, but check.
DROP TRIGGER IF EXISTS update_balance_from_receipt_header ON receipts;
DROP TRIGGER IF EXISTS update_balance_from_payment_header ON payments;

-- 6. Ensure ONLY the correct trigger exists
-- The correct trigger is on `journal_entry_lines` named `on_journal_entry_line_change`
-- calling `update_account_balance_trigger()`.
-- We DO NOT drop that one.

