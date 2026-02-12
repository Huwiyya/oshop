-- ============================================
-- System Accounts Mapping Table
-- ============================================
-- Purpose: Map system-level account references (like "Customers Control")
-- to actual account IDs, removing hardcoded account codes from application logic.

CREATE TABLE IF NOT EXISTS system_accounts (
    key TEXT PRIMARY KEY,
    account_id UUID REFERENCES accounts_v2(id) NOT NULL,
    description TEXT,
    is_locked BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_accounts_account_id ON system_accounts(account_id);

-- Insert core system account mappings
-- Note: These are based on the current Chart of Accounts structure
INSERT INTO system_accounts (key, account_id, description, is_locked)
SELECT 
    'CUSTOMERS_CONTROL',
    id,
    'Accounts Receivable - Customers Control Account',
    TRUE
FROM accounts_v2 WHERE code = '1120'
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_accounts (key, account_id, description, is_locked)
SELECT 
    'SUPPLIERS_CONTROL',
    id,
    'Accounts Payable - Suppliers Control Account',
    TRUE
FROM accounts_v2 WHERE code = '2110'
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_accounts (key, account_id, description, is_locked)
SELECT 
    'EMPLOYEES_PAYABLE',
    id,
    'Salaries and Wages Payable - Employees Control Account',
    TRUE
FROM accounts_v2 WHERE code = '2130'
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_accounts (key, account_id, description, is_locked)
SELECT 
    'INVENTORY_ASSET',
    id,
    'General Inventory Asset Account (Level 4)',
    TRUE
FROM accounts_v2 WHERE code = '113001'
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_accounts (key, account_id, description, is_locked)
SELECT 
    'SALES_REVENUE',
    id,
    'General Sales Revenue Account (Level 4)',
    TRUE
FROM accounts_v2 WHERE code = '410001'
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_accounts (key, account_id, description, is_locked)
SELECT 
    'COGS_EXPENSE',
    id,
    'Cost of Goods Sold Account (Level 4)',
    TRUE
FROM accounts_v2 WHERE code = '510001'
ON CONFLICT (key) DO NOTHING;

-- Helper function to get system account ID
CREATE OR REPLACE FUNCTION get_system_account(p_key TEXT)
RETURNS UUID AS $$
DECLARE
    v_account_id UUID;
BEGIN
    SELECT account_id INTO v_account_id
    FROM system_accounts
    WHERE key = p_key;
    
    IF v_account_id IS NULL THEN
        RAISE EXCEPTION 'System account not found: %', p_key;
    END IF;
    
    RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- Prevent deletion/update of locked system accounts
CREATE OR REPLACE FUNCTION protect_system_accounts()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_locked = TRUE THEN
        RAISE EXCEPTION 'Cannot modify or delete locked system account: %', OLD.key;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_system_account_changes ON system_accounts;
CREATE TRIGGER prevent_system_account_changes
BEFORE UPDATE OR DELETE ON system_accounts
FOR EACH ROW
EXECUTE FUNCTION protect_system_accounts();

-- Verify all mappings
DO $$
DECLARE
    missing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO missing_count
    FROM system_accounts
    WHERE account_id IS NULL;
    
    IF missing_count > 0 THEN
        RAISE WARNING '⚠️ % system accounts have NULL account_id. Please verify Chart of Accounts.', missing_count;
    ELSE
        RAISE NOTICE '✓ All system accounts mapped successfully';
    END IF;
END $$;
