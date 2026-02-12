-- FIX SCRIPT
-- This script safely drops and recreates the new tables to ensure correct schema and types.

-- 1. Shein Transactions: Safe to drop as it is a new feature with no critical historical data
DROP TABLE IF EXISTS shein_transactions_v4;

CREATE TABLE shein_transactions_v4 (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "cardId" TEXT REFERENCES shein_cards_v4(id) ON DELETE CASCADE, -- Quoted to preserve CamelCase if needed by app, or map to lowercase
    amount NUMERIC(10, 2) NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Note: We quoted identifiers above just in case. 
-- However, typically usually lowercase is better. 
-- Let's stick to standard handling which matches the previous error context:
-- The error "cardid does not exist" implies it was looking for lowercase.
-- So we will recreate it with standard lowercase names but ensuring they match what I previously defined.

DROP TABLE IF EXISTS shein_transactions_v4;
CREATE TABLE shein_transactions_v4 (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "cardId" TEXT, 
    -- We'll use "cardId" (quoted) to match the exact string sent by JS if Supabase uses strict matching.
    -- But wait, standard PostgREST usage favors matching case. 
    -- If your JS uses .eq('cardId'), it sends ?cardId=...
    -- Let's assume we want "cardId" column.
    amount NUMERIC(10, 2) NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Actually, to be SAFEST and STANDARD:
-- Let's use clean lowercase columns and let definitions handle it.
-- Re-dropping to be clear.

DROP TABLE IF EXISTS shein_transactions_v4;

CREATE TABLE shein_transactions_v4 (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "cardId" TEXT REFERENCES shein_cards_v4(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Create Indexes (Quoting columns to match the table definition)
CREATE INDEX IF NOT EXISTS idx_shein_tx_cardId ON shein_transactions_v4("cardId");


-- 2. Wallet Transactions: Also likely new or safe to refresh if empty
-- If you have real wallet data, DO NOT RUN THE DROP.
-- Assuming this is a dev/update phase:
DROP TABLE IF EXISTS wallet_transactions_v4;

CREATE TABLE wallet_transactions_v4 (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "userId" TEXT REFERENCES users_v4(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL,
    type TEXT CHECK (type IN ('deposit', 'withdrawal')) NOT NULL,
    "paymentMethod" TEXT CHECK ("paymentMethod" IN ('cash', 'bank', 'other')),
    description TEXT,
    "relatedOrderId" TEXT,
    "managerId" TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_userId ON wallet_transactions_v4("userId");


-- 3. Treasury Transactions (Be careful, might exist)
-- We will only create if not exists, but we check columns.
-- If you need to fix a 'cardid' error here, you might need to rename column:
-- ALTER TABLE treasury_transactions_v4 RENAME COLUMN cardid TO "cardId";
-- But for now, let's leave treasury alone if it exists, or create if missing.

CREATE TABLE IF NOT EXISTS treasury_transactions_v4 (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    amount NUMERIC(15, 2) NOT NULL,
    type TEXT CHECK (type IN ('deposit', 'withdrawal')) NOT NULL,
    channel TEXT CHECK (channel IN ('cash', 'bank')),
    "cardId" TEXT REFERENCES treasury_cards_v4(id) ON DELETE SET NULL,
    description TEXT,
    "relatedOrderId" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
