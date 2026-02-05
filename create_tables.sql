-- Enable Row Level Security (RLS) is generally good, but for now we create tables open or with basic policies if needed. 
-- Since we use Service Role Key for sync, RLS won't block it.
-- But for Client side access (if any), RLS is important.
-- For now, we will just create the tables.

-- users_v4
CREATE TABLE IF NOT EXISTS public.users_v4 (
    id TEXT PRIMARY KEY,
    name TEXT,
    username TEXT,
    password TEXT,
    phone TEXT,
    address TEXT,
    "orderCount" NUMERIC DEFAULT 0,
    debt NUMERIC DEFAULT 0,
    "orderCounter" NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- managers_v4
CREATE TABLE IF NOT EXISTS public.managers_v4 (
    id TEXT PRIMARY KEY,
    name TEXT,
    username TEXT,
    password TEXT,
    phone TEXT,
    permissions TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- representatives_v4
CREATE TABLE IF NOT EXISTS public.representatives_v4 (
    id TEXT PRIMARY KEY,
    name TEXT,
    username TEXT,
    password TEXT,
    phone TEXT,
    "assignedOrders" NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- orders_v4
CREATE TABLE IF NOT EXISTS public.orders_v4 (
    id TEXT PRIMARY KEY,
    "invoiceNumber" TEXT,
    "trackingId" TEXT,
    "userId" TEXT,
    "customerName" TEXT,
    "operationDate" TEXT,
    "sellingPriceLYD" NUMERIC,
    "remainingAmount" NUMERIC,
    status TEXT,
    "productLinks" TEXT,
    "exchangeRate" NUMERIC,
    "purchasePriceUSD" NUMERIC,
    "downPaymentLYD" NUMERIC,
    "weightKG" NUMERIC,
    "pricePerKilo" NUMERIC,
    "pricePerKiloCurrency" TEXT,
    "customerWeightCost" NUMERIC,
    "customerWeightCostCurrency" TEXT,
    "addedCostUSD" NUMERIC,
    "addedCostNotes" TEXT,
    store TEXT,
    "paymentMethod" TEXT,
    "deliveryDate" TEXT,
    "itemDescription" TEXT,
    "shippingCostLYD" NUMERIC,
    "representativeId" TEXT,
    "representativeName" TEXT,
    "customerAddress" TEXT,
    "customerPhone" TEXT,
    "collectedAmount" NUMERIC,
    "customerWeightCostUSD" NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- tempOrders_v4
-- This contains nested SubOrder[] which is complex for strict schema. 
-- We will use JSONB for the subOrders array.
CREATE TABLE IF NOT EXISTS public."tempOrders_v4" (
    id TEXT PRIMARY KEY,
    "invoiceName" TEXT,
    "totalAmount" NUMERIC,
    "remainingAmount" NUMERIC,
    status TEXT,
    "subOrders" JSONB,
    "createdAt" TEXT,
    "assignedUserId" TEXT,
    "assignedUserName" TEXT,
    "parentInvoiceId" TEXT
);

-- transactions_v4
CREATE TABLE IF NOT EXISTS public.transactions_v4 (
    id TEXT PRIMARY KEY,
    "orderId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    date TEXT,
    type TEXT,
    status TEXT,
    amount NUMERIC,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- conversations_v4
CREATE TABLE IF NOT EXISTS public.conversations_v4 (
    id TEXT PRIMARY KEY,
    "userId" TEXT,
    "userName" TEXT,
    "userAvatar" TEXT,
    "lastMessage" TEXT,
    "lastMessageTime" TEXT,
    "unreadCount" NUMERIC,
    messages JSONB, -- Storing array of messages as JSONB
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- creditors_v4
CREATE TABLE IF NOT EXISTS public.creditors_v4 (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT,
    currency TEXT,
    "totalDebt" NUMERIC,
    "contactInfo" TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- deposits_v4
CREATE TABLE IF NOT EXISTS public.deposits_v4 (
    id TEXT PRIMARY KEY,
    "receiptNumber" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    amount NUMERIC,
    date TEXT,
    description TEXT,
    status TEXT,
    "representativeId" TEXT,
    "representativeName" TEXT,
    "collectedBy" TEXT,
    "collectedDate" TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- settings_v4
-- Usually a single document but collection implies multiple or keyed by ID.
CREATE TABLE IF NOT EXISTS public.settings_v4 (
    id TEXT PRIMARY KEY,
    "exchangeRate" NUMERIC,
    "pricePerKiloLYD" NUMERIC,
    "pricePerKiloUSD" NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables (Best Practice)
ALTER TABLE public.users_v4 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers_v4 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.representatives_v4 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders_v4 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tempOrders_v4" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions_v4 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations_v4 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creditors_v4 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits_v4 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_v4 ENABLE ROW LEVEL SECURITY;

-- Create Policy to allow everything for Service Role and Auth Users (Simplified for now)
-- Note: Service Role bypasses RLS automatically.
-- We add a policy for anon/authenticated if needed, but for this task sync is key.
-- Let's make it public for now to avoid permission issues during user testing if they try from client.
CREATE POLICY "Enable all access for all users" ON public.users_v4 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON public.managers_v4 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON public.representatives_v4 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON public.orders_v4 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON public."tempOrders_v4" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON public.transactions_v4 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON public.conversations_v4 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON public.creditors_v4 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON public.deposits_v4 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON public.settings_v4 FOR ALL USING (true) WITH CHECK (true);
