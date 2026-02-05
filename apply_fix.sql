-- Create Treasury Transactions Table
CREATE TABLE IF NOT EXISTS treasury_transactions_v4 (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
  amount FLOAT NOT NULL,
  type TEXT CHECK (type IN ('deposit', 'withdrawal')),
  description TEXT,
  "relatedOrderId" TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
