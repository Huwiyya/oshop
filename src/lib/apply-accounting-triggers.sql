-- Apply Accounting Triggers for Balance Updates
-- Goal: Ensure 'current_balance' in accounts table updates automatically when journal entries are made.

-- 1. Function: Update Account Balance (Trigger Base)
CREATE OR REPLACE FUNCTION update_account_balance_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT case
    IF (TG_OP = 'INSERT') THEN
        UPDATE accounts
        SET current_balance = COALESCE(current_balance, 0) + (NEW.debit - NEW.credit),
            updated_at = NOW()
        WHERE id = NEW.account_id;
        RETURN NEW;
    
    -- Handle DELETE case
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE accounts
        SET current_balance = COALESCE(current_balance, 0) - (OLD.debit - OLD.credit),
            updated_at = NOW()
        WHERE id = OLD.account_id;
        RETURN OLD;

    -- Handle UPDATE case
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Revert OLD change
        UPDATE accounts
        SET current_balance = COALESCE(current_balance, 0) - (OLD.debit - OLD.credit)
        WHERE id = OLD.account_id;

        -- Apply NEW change
        UPDATE accounts
        SET current_balance = COALESCE(current_balance, 0) + (NEW.debit - NEW.credit),
            updated_at = NOW()
        WHERE id = NEW.account_id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger Definition
DROP TRIGGER IF EXISTS on_journal_entry_line_change ON journal_entry_lines;

CREATE TRIGGER on_journal_entry_line_change
AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
FOR EACH ROW
EXECUTE FUNCTION update_account_balance_trigger();

-- 3. Recalculate all balances (Optional but recommended to fix any discrepancies)
-- This resets all balances to 0 and recalculates them from journal entry lines.
-- RUN THIS ONLY IF BALANCES ARE WRONG.
-- UNCOMMENT TO RUN:
/*
UPDATE accounts SET current_balance = opening_balance;

WITH calculated_balances AS (
    SELECT account_id, SUM(debit - credit) as net_change
    FROM journal_entry_lines
    GROUP BY account_id
)
UPDATE accounts 
SET current_balance = COALESCE(accounts.opening_balance, 0) + cb.net_change
FROM calculated_balances cb
WHERE accounts.id = cb.account_id;
*/

DO $$
BEGIN
    RAISE NOTICE 'Accounting Triggers Applied Successfully.';
END $$;
