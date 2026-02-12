# تعليمات تحديث قاعدة البيانات (Database Update Instructions)

لضمان عمل ميزات "نقل المخزون" و "قيود الأمان" بشكل صحيح، يرجى تنفيذ أوامر SQL التالية في محرر SQL الخاص بـ Supabase (SQL Editor).

## 1. قيود الأمان (Security Constraints)
انسخ الكود التالي ونفذه لمنع التعديل المباشر على البيانات المالية وحماية القيود المرحلة:

```sql
-- ============================================
-- Security & Integrity Constraints
-- ============================================

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
            -- Allow DELETE for "Flexible Editing" feature (Atomic RPCs handle cleanup)
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

CREATE OR REPLACE FUNCTION check_invoice_deletion_safety()
RETURNS TRIGGER AS $$
BEGIN
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

DROP TRIGGER IF EXISTS trg_check_sales_delete ON sales_invoices;
CREATE TRIGGER trg_check_sales_delete
    BEFORE DELETE ON sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION check_invoice_deletion_safety();

DROP TRIGGER IF EXISTS trg_check_purchase_delete ON purchase_invoices;
CREATE TRIGGER trg_check_purchase_delete
    BEFORE DELETE ON purchase_invoices
    FOR EACH ROW
    EXECUTE FUNCTION check_invoice_deletion_safety();

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
```

## 2. نقل المخزون (Inventory Transfer)
انسخ الكود التالي ونفذه لتفعيل وظيفة نقل المخزون:

```sql
CREATE OR REPLACE FUNCTION transfer_inventory_rpc(
    p_item_id TEXT,
    p_quantity DECIMAL,
    p_from_location TEXT, -- Could be 'Main Store' or just a note if we don't have multi-location tables
    p_to_location TEXT,
    p_date DATE,
    p_notes TEXT
)
RETURNS JSONB AS $func$
DECLARE
    transfer_ref TEXT;
BEGIN
    transfer_ref := 'TRF-' || to_char(NOW(), 'YYYYMMDD-HH24MISS');

    INSERT INTO inventory_transactions (
        item_id, transaction_type, transaction_date, quantity, 
        unit_cost, total_cost, reference_type, reference_id, notes
    ) VALUES (
        p_item_id, 'transfer', p_date, 0, -- Log only, or implement + / - if locations exist
        0, 0, 'transfer', transfer_ref, 
        'Transfer from ' || p_from_location || ' to ' || p_to_location || '. ' || COALESCE(p_notes, '')
    );
    
    RETURN jsonb_build_object('success', true, 'ref', transfer_ref);
END;
$func$ LANGUAGE plpgsql;
```
