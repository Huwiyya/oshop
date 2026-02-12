-- Add cardId to treasury_transactions_v4
ALTER TABLE public.treasury_transactions_v4
ADD COLUMN IF NOT EXISTS "cardId" UUID;

-- Fix Constraint on treasury_cards_v4
-- We drop the old constraint and add a new one including 'usdt_treasury'
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treasury_cards_v4_type_check') THEN
        ALTER TABLE public.treasury_cards_v4 DROP CONSTRAINT treasury_cards_v4_type_check;
    END IF;
END $$;

ALTER TABLE public.treasury_cards_v4
ADD CONSTRAINT treasury_cards_v4_type_check 
CHECK (type IN ('cash_libyan', 'bank', 'cash_dollar', 'usdt_treasury'));


-- Insert 'usdt_treasury' into treasury_cards_v4 if not exists
INSERT INTO public.treasury_cards_v4 (name, type, balance, currency)
VALUES ('خزينة USDT', 'usdt_treasury', 0, 'USD')
ON CONFLICT (type) DO NOTHING;

-- Update existing transactions to link to 'usdt_treasury' if they are missing cardId
-- Assuming legacy transactions were mostly USDT
UPDATE public.treasury_transactions_v4
SET "cardId" = (SELECT id FROM public.treasury_cards_v4 WHERE type = 'usdt_treasury')
WHERE "cardId" IS NULL;
