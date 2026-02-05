-- =====================================================
-- Indexes لتحسين الأداء
-- =====================================================
-- هذا الملف يضيف indexes على الحقول الأكثر استخداماً في البحث والفرز
-- ملاحظة: الأسماء محاطة بـ quotes لأن الـ schema يستخدم camelCase

-- Orders Table
CREATE INDEX IF NOT EXISTS idx_orders_userId ON orders_v4("userId");
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders_v4(status);
CREATE INDEX IF NOT EXISTS idx_orders_invoiceNumber ON orders_v4("invoiceNumber");
CREATE INDEX IF NOT EXISTS idx_orders_trackingId ON orders_v4("trackingId");
CREATE INDEX IF NOT EXISTS idx_orders_operationDate ON orders_v4("operationDate");
CREATE INDEX IF NOT EXISTS idx_orders_representativeId ON orders_v4("representativeId");
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON orders_v4(deleted_at);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders_v4(created_at);

-- Users Table
CREATE INDEX IF NOT EXISTS idx_users_phone ON users_v4(phone);
CREATE INDEX IF NOT EXISTS idx_users_username ON users_v4(username);
CREATE INDEX IF NOT EXISTS idx_users_debt ON users_v4(debt);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users_v4(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_orderCount ON users_v4("orderCount");

-- Transactions Table
CREATE INDEX IF NOT EXISTS idx_transactions_customerId ON transactions_v4("customerId");
CREATE INDEX IF NOT EXISTS idx_transactions_orderId ON transactions_v4("orderId");
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions_v4(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions_v4(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions_v4(status);

-- Treasury Transactions
CREATE INDEX IF NOT EXISTS idx_treasury_tx_cardId ON treasury_transactions_v4("cardId");
CREATE INDEX IF NOT EXISTS idx_treasury_tx_type ON treasury_transactions_v4(type);
CREATE INDEX IF NOT EXISTS idx_treasury_tx_relatedOrderId ON treasury_transactions_v4("relatedOrderId");
CREATE INDEX IF NOT EXISTS idx_treasury_tx_createdAt ON treasury_transactions_v4("createdAt");

-- Wallet Transactions
CREATE INDEX IF NOT EXISTS idx_wallet_tx_userId ON wallet_transactions_v4("userId");
CREATE INDEX IF NOT EXISTS idx_wallet_tx_type ON wallet_transactions_v4(type);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_createdAt ON wallet_transactions_v4("createdAt");

-- Shein Cards
CREATE INDEX IF NOT EXISTS idx_shein_cards_status ON shein_cards_v4(status);
CREATE INDEX IF NOT EXISTS idx_shein_cards_code ON shein_cards_v4(code);

-- Shein Transactions
CREATE INDEX IF NOT EXISTS idx_shein_tx_cardId ON shein_transactions_v4("cardId");
CREATE INDEX IF NOT EXISTS idx_shein_tx_orderId ON shein_transactions_v4("orderId");

-- Representatives
CREATE INDEX IF NOT EXISTS idx_representatives_username ON representatives_v4(username);
CREATE INDEX IF NOT EXISTS idx_representatives_deleted_at ON representatives_v4(deleted_at);
CREATE INDEX IF NOT EXISTS idx_representatives_assignedOrders ON representatives_v4("assignedOrders");

-- Managers
CREATE INDEX IF NOT EXISTS idx_managers_username ON managers_v4(username);
CREATE INDEX IF NOT EXISTS idx_managers_deleted_at ON managers_v4(deleted_at);

-- Deposits
CREATE INDEX IF NOT EXISTS idx_deposits_userId ON deposits_v4("userId");
CREATE INDEX IF NOT EXISTS idx_deposits_representativeId ON deposits_v4("representativeId");
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits_v4(status);
CREATE INDEX IF NOT EXISTS idx_deposits_date ON deposits_v4(date);

-- Temp Orders
CREATE INDEX IF NOT EXISTS idx_tempOrders_assignedUserId ON "tempOrders_v4"("assignedUserId");
CREATE INDEX IF NOT EXISTS idx_tempOrders_status ON "tempOrders_v4"(status);

-- Composite Indexes للاستعلامات الشائعة
CREATE INDEX IF NOT EXISTS idx_orders_user_status 
    ON orders_v4("userId", status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_rep_status 
    ON orders_v4("representativeId", status) WHERE deleted_at IS NULL;

-- تم إنشاء جميع الـ Indexes بنجاح!
