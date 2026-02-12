-- =============================================================================
-- FIXED ASSETS SCHEMA V2
-- =============================================================================

BEGIN;

-- 1. Fixed Assets Registry
CREATE TABLE IF NOT EXISTS public.fixed_assets_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_number TEXT NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    acquisition_date DATE NOT NULL,
    cost DECIMAL(20, 4) NOT NULL,
    salvage_value DECIMAL(20, 4) DEFAULT 0,
    useful_life_years INTEGER NOT NULL DEFAULT 5,
    
    -- Depreciation Status
    accumulated_depreciation DECIMAL(20, 4) DEFAULT 0,
    book_value DECIMAL(20, 4) GENERATED ALWAYS AS (cost - accumulated_depreciation) STORED,
    
    -- Accounts
    asset_account_id UUID NOT NULL REFERENCES public.accounts_v2(id), -- e.g. Vehicles
    accumulated_depreciation_account_id UUID NOT NULL REFERENCES public.accounts_v2(id), -- Contra-Asset
    depreciation_expense_account_id UUID NOT NULL REFERENCES public.accounts_v2(id), -- Expense
    
    status TEXT DEFAULT 'active', -- active, disposed, fully_depreciated
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Depreciation Logs (History)
CREATE TABLE IF NOT EXISTS public.depreciation_entries_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES public.fixed_assets_v2(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE, -- Depreciation Date
    amount DECIMAL(20, 4) NOT NULL,
    description TEXT,
    
    status public.journal_status_v2 DEFAULT 'draft',
    journal_entry_id UUID REFERENCES public.journal_entries_v2(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Trigger for Depreciation Journal
CREATE OR REPLACE FUNCTION public.create_depreciation_journal_v2()
RETURNS TRIGGER AS $$
DECLARE
    v_journal_id UUID;
    v_old_status public.journal_status_v2;
    v_asset RECORD;
BEGIN
    v_old_status := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END;
    
    IF NEW.status = 'posted' AND (v_old_status IS NULL OR v_old_status != 'posted') THEN
        -- Fetch Asset Details for Accounts
        SELECT * INTO v_asset FROM public.fixed_assets_v2 WHERE id = NEW.asset_id;
        
        -- Create Header
        INSERT INTO public.journal_entries_v2 (
            entry_number, date, description, status, source_type, source_id, total_debit, total_credit
        ) VALUES (
            'DEP-' || v_asset.asset_number || '-' || to_char(NEW.date, 'YYYYMMDD'), 
            NEW.date, 
            'Depreciation: ' || v_asset.name_en, 
            'posted', 
            'depreciation_entry', 
            NEW.id, 
            NEW.amount, 
            NEW.amount
        ) RETURNING id INTO v_journal_id;
        
        -- Debit Depreciation Expense
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_asset.depreciation_expense_account_id, NEW.amount, 0, 'Depreciation Expense');
        
        -- Credit Accumulated Depreciation (Contra-Asset)
        INSERT INTO public.journal_lines_v2 (journal_id, account_id, debit, credit, description)
        VALUES (v_journal_id, v_asset.accumulated_depreciation_account_id, 0, NEW.amount, 'Accumulated Depreciation');
        
        -- Update Log link
        UPDATE public.depreciation_entries_v2 SET journal_entry_id = v_journal_id WHERE id = NEW.id;
        
        -- Update Asset Accum Depreciation
        UPDATE public.fixed_assets_v2 
        SET accumulated_depreciation = accumulated_depreciation + NEW.amount 
        WHERE id = NEW.asset_id;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_depreciation_journal_v2 ON public.depreciation_entries_v2;
CREATE TRIGGER trg_create_depreciation_journal_v2
    AFTER INSERT OR UPDATE ON public.depreciation_entries_v2
    FOR EACH ROW
    EXECUTE FUNCTION public.create_depreciation_journal_v2();

COMMIT;
