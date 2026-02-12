-- ============================================
-- Fixed Assets Management System - Database Schema (V2)
-- IMPORTANT: This will DROP existing tables if they exist
-- ============================================

-- Drop existing tables and functions if they exist
DROP TABLE IF EXISTS asset_depreciation_log CASCADE;
DROP TABLE IF EXISTS fixed_assets CASCADE;
DROP FUNCTION IF EXISTS generate_asset_code(TEXT, TEXT);
DROP FUNCTION IF EXISTS create_fixed_asset_rpc(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DECIMAL, INTEGER, DECIMAL, TEXT, TEXT, TEXT, TEXT, DATE);
DROP FUNCTION IF EXISTS dispose_fixed_asset_rpc(TEXT, DATE, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS calculate_monthly_depreciation(DATE);

-- 1. Create fixed_assets table (NEW VERSION)
CREATE TABLE fixed_assets (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    asset_code TEXT UNIQUE NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    
    -- Classification (using columns, not foreign key to asset_categories)
    asset_category TEXT NOT NULL CHECK (asset_category IN ('tangible', 'intangible', 'wip')),
    asset_subcategory TEXT, -- 'land', 'building', 'machinery', 'vehicle', 'computer', 'software', etc.
    
    -- Details
    description TEXT,
    acquisition_date DATE NOT NULL,
    acquisition_cost DECIMAL(19,4) NOT NULL,
    useful_life_years INTEGER, -- Asset useful life in years
    residual_value DECIMAL(19,4) DEFAULT 0, -- Salvage value at end of life
    
    -- Depreciation
    depreciation_method TEXT DEFAULT 'straight_line' CHECK (depreciation_method IN ('straight_line', 'declining_balance', 'none')),
    accumulated_depreciation DECIMAL(19,4) DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'disposed', 'under_maintenance')),
    disposal_date DATE,
    disposal_amount DECIMAL(19,4),
    disposal_notes TEXT,
    
    -- Additional Info
    location TEXT,
    responsible_person TEXT,
    serial_number TEXT,
    warranty_expiry DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create asset_depreciation_log table
CREATE TABLE asset_depreciation_log (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    asset_id TEXT NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
    period_date DATE NOT NULL,
    depreciation_amount DECIMAL(19,4) NOT NULL,
    journal_entry_id TEXT REFERENCES journal_entries(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(asset_id, period_date)
);

-- 3. Create indexes for performance
CREATE INDEX idx_fixed_assets_category ON fixed_assets(asset_category);
CREATE INDEX idx_fixed_assets_status ON fixed_assets(status);
CREATE INDEX idx_fixed_assets_account ON fixed_assets(account_id);
CREATE INDEX idx_depreciation_log_asset ON asset_depreciation_log(asset_id);
CREATE INDEX idx_depreciation_log_period ON asset_depreciation_log(period_date);

-- 4. Function to generate asset code
CREATE OR REPLACE FUNCTION generate_asset_code(p_category TEXT, p_subcategory TEXT)
RETURNS TEXT AS $$
DECLARE
    v_prefix TEXT;
    v_next_num INTEGER;
    v_code TEXT;
BEGIN
    -- Determine prefix based on category
    CASE p_category
        WHEN 'tangible' THEN
            CASE p_subcategory
                WHEN 'land' THEN v_prefix := 'LND';
                WHEN 'building' THEN v_prefix := 'BLD';
                WHEN 'machinery' THEN v_prefix := 'MCH';
                WHEN 'furniture' THEN v_prefix := 'FRN';
                WHEN 'computer' THEN v_prefix := 'CMP';
                WHEN 'vehicle' THEN v_prefix := 'VHC';
                ELSE v_prefix := 'TNG';
            END CASE;
        WHEN 'intangible' THEN
            CASE p_subcategory
                WHEN 'software' THEN v_prefix := 'SFT';
                WHEN 'trademark' THEN v_prefix := 'TRD';
                WHEN 'patent' THEN v_prefix := 'PAT';
                WHEN 'copyright' THEN v_prefix := 'CPR';
                ELSE v_prefix := 'INT';
            END CASE;
        WHEN 'wip' THEN v_prefix := 'WIP';
        ELSE v_prefix := 'AST';
    END CASE;
    
    -- Get next sequential number
    SELECT COALESCE(MAX(SUBSTRING(asset_code FROM LENGTH(v_prefix) + 2)::INTEGER), 0) + 1
    INTO v_next_num
    FROM fixed_assets
    WHERE asset_code LIKE v_prefix || '-%';
    
    v_code := v_prefix || '-' || LPAD(v_next_num::TEXT, 4, '0');
    RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- 5. RPC to create a fixed asset
CREATE OR REPLACE FUNCTION create_fixed_asset_rpc(
    p_name_ar TEXT,
    p_name_en TEXT,
    p_asset_category TEXT,
    p_asset_subcategory TEXT,
    p_description TEXT,
    p_acquisition_date DATE,
    p_acquisition_cost DECIMAL,
    p_useful_life_years INTEGER,
    p_residual_value DECIMAL,
    p_depreciation_method TEXT,
    p_location TEXT,
    p_responsible_person TEXT,
    p_serial_number TEXT,
    p_warranty_expiry DATE,
    p_payment_account_id TEXT DEFAULT '111001' -- ✅ حساب الدفع (نقدية/بنك)
)
RETURNS TEXT AS $$
DECLARE
    v_asset_code TEXT;
    v_asset_id TEXT;
    v_account_id TEXT;
    v_parent_code TEXT;
    v_journal_id TEXT;
    v_lines JSONB;
BEGIN
    -- Generate asset code
    v_asset_code := generate_asset_code(p_asset_category, p_asset_subcategory);
    
    -- Determine parent account code based on category and subcategory
    CASE p_asset_category
        WHEN 'tangible' THEN
            CASE p_asset_subcategory
                WHEN 'land' THEN v_parent_code := '1211';
                WHEN 'building' THEN v_parent_code := '1212';
                WHEN 'machinery' THEN v_parent_code := '1213';
                WHEN 'furniture' THEN v_parent_code := '1214';
                WHEN 'computer' THEN v_parent_code := '1215';
                WHEN 'vehicle' THEN v_parent_code := '1216';
                ELSE v_parent_code := '121';
            END CASE;
        WHEN 'intangible' THEN
            CASE p_asset_subcategory
                WHEN 'software' THEN v_parent_code := '1221';
                WHEN 'trademark' THEN v_parent_code := '1222';
                WHEN 'patent' THEN v_parent_code := '1223';
                WHEN 'copyright' THEN v_parent_code := '1224';
                ELSE v_parent_code := '122';
            END CASE;
        WHEN 'wip' THEN v_parent_code := '123';
        ELSE RAISE EXCEPTION 'Invalid asset category';
    END CASE;
    
    -- Get parent account ID from parent code
    SELECT id INTO v_account_id
    FROM accounts 
    WHERE account_code = v_parent_code;
    
    IF v_account_id IS NULL THEN
        RAISE EXCEPTION 'Parent account with code % not found', v_parent_code;
    END IF;
    
    -- Create account in chart of accounts using hierarchical function
    v_account_id := create_hierarchical_account_rpc(
        p_name_ar := p_name_ar,
        p_name_en := p_name_en,
        p_parent_id := v_account_id,
        p_description := p_description,
        p_currency := 'LYD'
    );
    
    -- Create fixed asset record
    INSERT INTO fixed_assets (
        account_id,
        asset_code,
        name_ar,
        name_en,
        asset_category,
        asset_subcategory,
        description,
        acquisition_date,
        acquisition_cost,
        useful_life_years,
        residual_value,
        depreciation_method,
        location,
        responsible_person,
        serial_number,
        warranty_expiry
    ) VALUES (
        v_account_id,
        v_asset_code,
        p_name_ar,
        p_name_en,
        p_asset_category,
        p_asset_subcategory,
        p_description,
        p_acquisition_date,
        p_acquisition_cost,
        p_useful_life_years,
        COALESCE(p_residual_value, 0),
        COALESCE(p_depreciation_method, 'straight_line'),
        p_location,
        p_responsible_person,
        p_serial_number,
        p_warranty_expiry
    ) RETURNING id INTO v_asset_id;
    
    -- Resolve Payment Account ID (Handle Code vs UUID)
    -- Use a separate block for exception handling logic
    DECLARE
        v_payment_uuid UUID;
        v_is_uuid BOOLEAN;
    BEGIN
        -- Check if string format looks like UUID
        v_is_uuid := (p_payment_account_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');
        
        IF v_is_uuid THEN
           v_payment_uuid := p_payment_account_id::UUID;
        ELSE
           -- It is a code
           SELECT id INTO v_payment_uuid FROM accounts WHERE account_code = p_payment_account_id;
        END IF;

        IF v_payment_uuid IS NULL THEN
            -- Attempt fallback lookup if it was a UUID that didn't exist or code not found
             SELECT id INTO v_payment_uuid FROM accounts WHERE account_code = p_payment_account_id;
             
             IF v_payment_uuid IS NULL THEN
                 RAISE EXCEPTION 'Payment Account not found (Input: %)', p_payment_account_id;
             END IF;
        END IF;

        -- ✅ إنشاء القيد المحاسبي لشراء الأصل
        -- من حـ/ الأصول الثابتة (مدين)
        -- إلى حـ/ النقدية/البنك (دائن)
        v_lines := jsonb_build_array(
            -- Debit: Fixed Asset Account
            jsonb_build_object(
                'accountId', v_account_id,
                'description', 'شراء أصل ثابت: ' || p_name_ar,
                'debit', p_acquisition_cost,
                'credit', 0
            ),
            -- Credit: Payment Account (Cash/Bank)
            jsonb_build_object(
                'accountId', v_payment_uuid,
                'description', 'دفع تكلفة شراء: ' || p_name_ar,
                'debit', 0,
                'credit', p_acquisition_cost
            )
        );
        
        -- Create journal entry
        v_journal_id := create_journal_entry_rpc(
            p_entry_date := p_acquisition_date,
            p_description := 'شراء أصل ثابت: ' || p_name_ar || ' - ' || v_asset_code,
            p_reference_type := 'asset_acquisition',
            p_reference_id := v_asset_id,
            p_lines := v_lines,
            p_is_hidden := FALSE
        );
    END;
    
    RETURN v_asset_id;
END;
$$ LANGUAGE plpgsql;

-- 6. RPC to dispose of a fixed asset
CREATE OR REPLACE FUNCTION dispose_fixed_asset_rpc(
    p_asset_id TEXT,
    p_disposal_date DATE,
    p_disposal_amount DECIMAL,
    p_disposal_notes TEXT
)
RETURNS TEXT AS $$
DECLARE
    v_asset RECORD;
    v_journal_id TEXT;
    v_gain_loss DECIMAL;
    v_gain_loss_account TEXT;
    v_lines JSONB;
    v_cash_account TEXT := '111001'; -- Default cash account
BEGIN
    -- Get asset details
    SELECT * INTO v_asset
    FROM fixed_assets
    WHERE id = p_asset_id AND status = 'active';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Asset not found or already disposed';
    END IF;
    
    -- Calculate gain/loss on disposal
    -- Book Value = Cost - Accumulated Depreciation
    v_gain_loss := p_disposal_amount - (v_asset.acquisition_cost - v_asset.accumulated_depreciation);
    
    -- Determine gain/loss account
    IF v_gain_loss >= 0 THEN
        v_gain_loss_account := '4600001'; -- Gain on disposal (Revenue)
    ELSE
        v_gain_loss_account := '5600001'; -- Loss on disposal (Expense)
    END IF;
    
    -- Prepare journal entry lines
    v_lines := jsonb_build_array(
        -- Debit: Cash/Bank (disposal proceeds)
        jsonb_build_object(
            'accountId', v_cash_account,
            'description', 'حصيلة بيع أصل: ' || v_asset.name_ar,
            'debit', p_disposal_amount,
            'credit', 0
        ),
        -- Debit: Accumulated Depreciation
        jsonb_build_object(
            'accountId', v_asset.account_id,
            'description', 'إقفال استهلاك متراكم: ' || v_asset.name_ar,
            'debit', v_asset.accumulated_depreciation,
            'credit', 0
        ),
        -- Credit: Asset Account (original cost)
        jsonb_build_object(
            'accountId', v_asset.account_id,
            'description', 'التخلص من الأصل: ' || v_asset.name_ar,
            'debit', 0,
            'credit', v_asset.acquisition_cost
        ),
        -- Gain or Loss
        jsonb_build_object(
            'accountId', v_gain_loss_account,
            'description', CASE WHEN v_gain_loss >= 0 THEN 'ربح بيع أصل' ELSE 'خسارة بيع أصل' END || ': ' || v_asset.name_ar,
            'debit', CASE WHEN v_gain_loss < 0 THEN ABS(v_gain_loss) ELSE 0 END,
            'credit', CASE WHEN v_gain_loss >= 0 THEN v_gain_loss ELSE 0 END
        )
    );
    
    -- Create journal entry
    v_journal_id := create_journal_entry_rpc(
        p_entry_date := p_disposal_date,
        p_description := 'التخلص من الأصل: ' || v_asset.name_ar || ' - ' || v_asset.asset_code,
        p_reference_type := 'asset_disposal',
        p_reference_id := p_asset_id,
        p_lines := v_lines
    );
    
    -- Update asset status
    UPDATE fixed_assets
    SET status = 'disposed',
        disposal_date = p_disposal_date,
        disposal_amount = p_disposal_amount,
        disposal_notes = p_disposal_notes,
        updated_at = NOW()
    WHERE id = p_asset_id;
    
    RETURN v_journal_id;
END;
$$ LANGUAGE plpgsql;

-- 7. Function to calculate and record monthly depreciation
CREATE OR REPLACE FUNCTION calculate_monthly_depreciation(p_period_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER AS $$
DECLARE
    v_asset RECORD;
    v_monthly_depreciation DECIMAL;
    v_journal_id TEXT;
    v_lines JSONB;
    v_count INTEGER := 0;
    v_depreciation_expense_account TEXT := '5500001'; -- Depreciation Expense account
BEGIN
    -- Loop through active assets that have depreciation
    FOR v_asset IN 
        SELECT * 
        FROM fixed_assets 
        WHERE status = 'active' 
          AND depreciation_method != 'none'
          AND useful_life_years > 0
          AND NOT EXISTS (
              SELECT 1 FROM asset_depreciation_log 
              WHERE asset_id = fixed_assets.id 
                AND period_date = p_period_date
          )
    LOOP
        -- Calculate monthly depreciation (Straight-Line method)
        IF v_asset.depreciation_method = 'straight_line' THEN
            v_monthly_depreciation := (v_asset.acquisition_cost - v_asset.residual_value) / 
                                     (v_asset.useful_life_years * 12);
        ELSE
            -- For now, only straight-line is implemented
            CONTINUE;
        END IF;
        
        -- Don't depreciate beyond book value
        IF v_asset.accumulated_depreciation + v_monthly_depreciation > 
           (v_asset.acquisition_cost - v_asset.residual_value) THEN
            v_monthly_depreciation := (v_asset.acquisition_cost - v_asset.residual_value) - 
                                     v_asset.accumulated_depreciation;
        END IF;
        
        -- Skip if no depreciation needed
        IF v_monthly_depreciation <= 0 THEN
            CONTINUE;
        END IF;
        
        -- Create journal entry for depreciation
        v_lines := jsonb_build_array(
            -- Debit: Depreciation Expense
            jsonb_build_object(
                'accountId', v_depreciation_expense_account,
                'description', 'استهلاك شهري: ' || v_asset.name_ar,
                'debit', v_monthly_depreciation,
                'credit', 0
            ),
            -- Credit: Accumulated Depreciation (using asset account)
            jsonb_build_object(
                'accountId', v_asset.account_id,
                'description', 'استهلاك متراكم: ' || v_asset.name_ar,
                'debit', 0,
                'credit', v_monthly_depreciation
            )
        );
        
        v_journal_id := create_journal_entry_rpc(
            p_entry_date := p_period_date,
            p_description := 'استهلاك شهري - ' || TO_CHAR(p_period_date, 'YYYY-MM'),
            p_reference_type := 'depreciation',
            p_reference_id := v_asset.id,
            p_lines := v_lines,
            p_is_hidden := TRUE
        );
        
        -- Log depreciation
        INSERT INTO asset_depreciation_log (asset_id, period_date, depreciation_amount, journal_entry_id)
        VALUES (v_asset.id, p_period_date, v_monthly_depreciation, v_journal_id);
        
        -- Update accumulated depreciation
        UPDATE fixed_assets
        SET accumulated_depreciation = accumulated_depreciation + v_monthly_depreciation,
            updated_at = NOW()
        WHERE id = v_asset.id;
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Fixed Assets V2 schema created successfully!';
END $$;
