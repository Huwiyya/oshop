-- Enable UUID extension just in case we need it for generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Shein Cards Table
CREATE TABLE IF NOT EXISTS shein_cards_v4 (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    code TEXT NOT NULL,
    value NUMERIC(10, 2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT CHECK (status IN ('available', 'used', 'expired')) DEFAULT 'available',
    purchaseDate TIMESTAMPTZ DEFAULT NOW(),
    expiryDate TIMESTAMPTZ,
    usedAt TIMESTAMPTZ,
    usedForOrderId TEXT, -- Can be linked to orders_v4 if needed
    notes TEXT,
    remainingValue NUMERIC(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Shein Transactions Table (New History Log)
CREATE TABLE IF NOT EXISTS shein_transactions_v4 (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    cardId TEXT REFERENCES shein_cards_v4(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    orderId TEXT, -- Can link to orders_v4(id)
    createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Treasury Cards Table
CREATE TABLE IF NOT EXISTS treasury_cards_v4 (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('cash_libyan', 'bank', 'cash_dollar', 'usdt_treasury')) NOT NULL,
    balance NUMERIC(15, 2) DEFAULT 0,
    currency TEXT CHECK (currency IN ('LYD', 'USD')) NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Treasury Transactions Table
CREATE TABLE IF NOT EXISTS treasury_transactions_v4 (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    amount NUMERIC(15, 2) NOT NULL,
    type TEXT CHECK (type IN ('deposit', 'withdrawal')) NOT NULL,
    channel TEXT CHECK (channel IN ('cash', 'bank')),
    cardId TEXT REFERENCES treasury_cards_v4(id) ON DELETE SET NULL,
    description TEXT,
    relatedOrderId TEXT,
    createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Wallet Transactions Table (User Wallet)
CREATE TABLE IF NOT EXISTS wallet_transactions_v4 (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    userId TEXT REFERENCES users_v4(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL,
    type TEXT CHECK (type IN ('deposit', 'withdrawal')) NOT NULL,
    paymentMethod TEXT CHECK (paymentMethod IN ('cash', 'bank', 'other')),
    description TEXT,
    relatedOrderId TEXT,
    managerId TEXT, -- Can link to managers_v4
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Products Table (Optional Inventory)
CREATE TABLE IF NOT EXISTS products_v4 (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL,
    sku TEXT,
    quantity INTEGER DEFAULT 0,
    minStockLevel INTEGER DEFAULT 0,
    costPriceUSD NUMERIC(10, 2) DEFAULT 0,
    sellingPriceLYD NUMERIC(10, 2) DEFAULT 0,
    sellingPriceUSD NUMERIC(10, 2) DEFAULT 0,
    description TEXT,
    category TEXT,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Global Sites (Settings)
CREATE TABLE IF NOT EXISTS global_sites_v4 (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    logo TEXT
);

-- Optional: Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_shein_cards_status ON shein_cards_v4(status);
CREATE INDEX IF NOT EXISTS idx_shein_tx_cardId ON shein_transactions_v4(cardId);
CREATE INDEX IF NOT EXISTS idx_treasury_tx_cardId ON treasury_transactions_v4(cardId);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_userId ON wallet_transactions_v4(userId);
