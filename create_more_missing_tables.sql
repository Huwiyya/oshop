-- Create missing expenses_v4 table
CREATE TABLE IF NOT EXISTS public.expenses_v4 (
    id TEXT PRIMARY KEY,
    description TEXT,
    amount NUMERIC,
    date TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create missing external_debts_v4 table
CREATE TABLE IF NOT EXISTS public.external_debts_v4 (
    id TEXT PRIMARY KEY,
    "creditorId" TEXT,
    "creditorName" TEXT,
    amount NUMERIC,
    date TEXT,
    status TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.expenses_v4 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_debts_v4 ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Enable all access for all users" ON public.expenses_v4 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON public.external_debts_v4 FOR ALL USING (true) WITH CHECK (true);
