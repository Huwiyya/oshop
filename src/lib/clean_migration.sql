-- ============================================
-- 1. Security & Integrity Constraints
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

-- ============================================
-- 2. Inventory Transfer Function
-- ============================================

-- ============================================
-- 2. Flexible Inventory Transaction (Open Transfer / Conversion)
-- ============================================

CREATE OR REPLACE FUNCTION create_inventory_transaction_rpc(
    p_date DATE,
    p_ref_number TEXT, 
    p_description TEXT,
    p_lines JSONB -- Array of { itemId, quantity, unitCost?, notes? }
)
RETURNS JSONB AS $func$
DECLARE
    new_ref TEXT;
    rec JSONB;
    item_qt DECIMAL(19,4);
    item_cost DECIMAL(19,4);
BEGIN
    IF p_ref_number IS NULL OR p_ref_number = '' THEN
        new_ref := 'INV-' || to_char(p_date, 'YYYYMMDD') || '-' || to_char(NOW(), 'HH24MISS');
    ELSE
        new_ref := p_ref_number;
    END IF;

    FOR rec IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        item_qt := (rec->>'quantity')::DECIMAL;
        
        -- A. Update Inventory Item Master
        UPDATE inventory_items 
        SET quantity_on_hand = quantity_on_hand + item_qt,
            updated_at = NOW()
        WHERE id = rec->>'itemId';
        
        -- B. Costing
        IF rec->>'unitCost' IS NOT NULL THEN
            item_cost := (rec->>'unitCost')::DECIMAL;
        ELSE
            SELECT average_cost INTO item_cost FROM inventory_items WHERE id = rec->>'itemId';
            item_cost := COALESCE(item_cost, 0);
        END IF;

        -- C. Create Transaction Record
        INSERT INTO inventory_transactions (
            item_id, transaction_type, transaction_date, quantity, 
            unit_cost, total_cost, reference_type, reference_id, notes
        ) VALUES (
            rec->>'itemId', 
            CASE WHEN item_qt > 0 THEN 'transfer_in' ELSE 'transfer_out' END,
            p_date,
            ABS(item_qt), 
            item_cost,
            ABS(item_qt) * item_cost,
            'open_transfer',
            new_ref,
            COALESCE(rec->>'notes', p_description)
        );
        
        -- D. Layer Logic (Simple In/Out)
        IF item_qt > 0 THEN
             INSERT INTO inventory_layers (
                 item_id, purchase_date, quantity, remaining_quantity, unit_cost
             ) VALUES (
                 rec->>'itemId', p_date, item_qt, item_qt, item_cost
             );
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'ref', new_ref);
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Inventory Transaction Failed: %', SQLERRM;
END;
$func$ LANGUAGE plpgsql;
