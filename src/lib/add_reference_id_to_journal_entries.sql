-- ============================================================================
-- ADD MISSING REFERENCE_ID COLUMN TO JOURNAL_ENTRIES_V2
-- ============================================================================
-- The atomic treasury functions need to UPDATE reference_id on journal_entries
-- after creating receipts/payments, but this column doesn't exist yet.

ALTER TABLE journal_entries_v2 
ADD COLUMN IF NOT EXISTS reference_id UUID;

-- Add comment for documentation
COMMENT ON COLUMN journal_entries_v2.reference_id IS 'UUID of the source transaction (receipt_id, payment_id, invoice_id, etc.) - populated after transaction creation';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_journal_entries_v2_reference_id 
ON journal_entries_v2(reference_id) 
WHERE reference_id IS NOT NULL;
