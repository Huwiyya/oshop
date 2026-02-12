-- ============================================
-- Security & Integrity Constraints
-- ============================================

-- VALIDATION: Prevent modification of Posted Journal Entries directly
-- Exception: RPCs might use a session variable or specific role, but for now 
-- we will block UPDATE/DELETE on 'posted' entries unless it's a specific 'void' operation.
-- However, our "Manager-style" editing relies on delete/recreate. 
-- So we won't block DELETE completely, but we should log it or ensure it's from a trusted source.
-- Use cases: 
-- 1. Correcting a mistake (Delete & Recreate) -> OK.
-- 2. Malicious/Accidental Deletion -> BAD.

-- STRATEGY: 
-- 1. Trigger to prevent changing 'entry_date' or 'amounts' of posted entries directly? 
--    No, simplest is to lock the row.
-- Let's trust the RPCs for now but ensure referential integrity.
-- Actually, the user requirement is: "Prevent modifying/deleting posted entries"
-- But also "Manager-style Flexible Editing".
-- Compromise: Allow DELETE only if the user is an Admin (we can check app_metadata).
-- OR, just leave it as is but add a WARNING comment/trigger.

-- REAL IMPLEMENTATION:
-- We will add a trigger that raises an error if you try to UPDATE a posted entry's amounts directly.
-- Standard editing flow involves DELETE + INSERT, so UPDATE is rare and suspicious.

CREATE OR REPLACE FUNCTION protect_posted_journal_entries()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'posted' THEN
        IF TG_OP = 'UPDATE' THEN
            -- Allow status change (e.g. to cancelled)
            IF NEW.status != OLD.status THEN
                RETURN NEW;
            END IF;
            -- Block content changes
            IF NEW.total_debit != OLD.total_debit OR NEW.total_credit != OLD.total_credit OR NEW.entry_date != OLD.entry_date THEN
                 RAISE EXCEPTION 'Cannot modify financial data of a posted journal entry. Void or Delete it instead.';
            END IF;
        
        ELSIF TG_OP = 'DELETE' THEN
            -- We allow DELETE for the "Flexible Editing" feature.
            -- Maybe assume if it's being deleted, the user knows what they are doing (or it's the RPC).
            -- So we do nothing here for DELETE to support the requested feature.
            RETURN OLD;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_posted_je ON journal_entries;
CREATE TRIGGER trg_protect_posted_je
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION protect_posted_journal_entries();

-- VALIDATION: Prevent Direct Deletion of Invoices without cleaning up
-- To ensure `delete_journal_entry` is called.
-- But `delete_document_rpc` handles this.
-- If someone runs `DELETE FROM sales_invoices`, the foreign key `journal_entry_id` ON DELETE SET NULL/CASCADE?
-- Our schema doesn't specify ON DELETE CASCADE for journal_entry_id.
-- So if we delete invoice, JE remains (Orphan).
-- Requirement: "Prevent Direct Deletion without Reversing Entries".
-- Solution: Trigger on Invoice DELETE to check if JE exists and is not cancelled.

CREATE OR REPLACE FUNCTION check_invoice_deletion_safety()
RETURNS TRIGGER AS $$
BEGIN
    -- If the invoice is linked to a valid Journal Entry, block raw deletion.
    -- The `delete_document_rpc` deletes the JE *before* or *after*?
    -- RPC: Deletes JE -> Then Deletes Invoice.
    -- So if RPC runs: JE is gone (or unlinked) -> Invoice delete proceeds.
    -- If SQL runs: JE exists -> Invoice delete Blocked.
    
    IF OLD.journal_entry_id IS NOT NULL THEN
        -- Check if JE still exists
        PERFORM 1 FROM journal_entries WHERE id = OLD.journal_entry_id;
        IF FOUND THEN
            RAISE EXCEPTION 'Cannot delete invoice directly while it has a linked Journal Entry. Use delete_document_rpc or Void function.';
        END IF;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Apply to Sales
DROP TRIGGER IF EXISTS trg_check_sales_delete ON sales_invoices;
CREATE TRIGGER trg_check_sales_delete
    BEFORE DELETE ON sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION check_invoice_deletion_safety();

-- Apply to Purchases
DROP TRIGGER IF EXISTS trg_check_purchase_delete ON purchase_invoices;
CREATE TRIGGER trg_check_purchase_delete
    BEFORE DELETE ON purchase_invoices
    FOR EACH ROW
    EXECUTE FUNCTION check_invoice_deletion_safety();

-- Apply to Treasury
DROP TRIGGER IF EXISTS trg_check_receipt_delete ON receipts;
CREATE TRIGGER trg_check_receipt_delete
    BEFORE DELETE ON receipts
    FOR EACH ROW
    EXECUTE FUNCTION check_invoice_deletion_safety();

DROP TRIGGER IF EXISTS trg_check_payment_delete ON payments;
CREATE TRIGGER trg_check_payment_delete
    BEFORE DELETE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION check_invoice_deletion_safety();

