-- Fix Treasury Transactions Table
-- It seems the table existed but was missing new columns like 'channel'.

ALTER TABLE treasury_transactions_v4 
ADD COLUMN IF NOT EXISTS "channel" TEXT CHECK (channel IN ('cash', 'bank')),
ADD COLUMN IF NOT EXISTS "relatedOrderId" TEXT,
ADD COLUMN IF NOT EXISTS "cardId" TEXT; -- Ensure this matches casing

-- Ensure cardId references treasury_cards_v4 if not already constrainted
-- (Optional/Advanced: duplicate formatting, safest to just add columns)

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload config';
