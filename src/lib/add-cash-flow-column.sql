-- Add cash_flow_type column to accounts table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'accounts'
        AND column_name = 'cash_flow_type'
    ) THEN
        ALTER TABLE public.accounts
        ADD COLUMN cash_flow_type TEXT CHECK (cash_flow_type IN ('operating', 'investing', 'financing'));
    END IF;
END $$;

SELECT 'Column cash_flow_type verified/added.' as status;
