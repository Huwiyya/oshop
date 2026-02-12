CREATE TABLE IF NOT EXISTS accounting_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  reference TEXT,
  type TEXT NOT NULL CHECK (type IN ('receipt', 'payment', 'transfer')),
  payer TEXT, -- For receipts
  payee TEXT, -- For payments
  account_id UUID REFERENCES treasury_cards_v4(id), -- The Cash/Bank account affected (Corrected table name)
  description TEXT,
  amount NUMERIC(15, 3) NOT NULL,
  currency TEXT DEFAULT 'LYD',
  line_items JSONB, -- Details of other side of entry
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_accounting_trx_date ON accounting_transactions(date);
CREATE INDEX IF NOT EXISTS idx_accounting_trx_type ON accounting_transactions(type);
