-- ============================================
-- Fiscal Periods Management & Period Locking
-- ============================================
-- Purpose: Prevent modification of journal entries in closed accounting periods

CREATE TABLE IF NOT EXISTS fiscal_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    closed_by UUID, -- User who closed the period (if user management exists)
    closed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(start_date, end_date),
    CHECK (end_date >= start_date)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_dates ON fiscal_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_closed ON fiscal_periods(is_closed);

-- Function to check if a date falls in a closed period
CREATE OR REPLACE FUNCTION is_period_closed(p_date DATE)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_closed BOOLEAN;
BEGIN
    SELECT is_closed INTO v_is_closed
    FROM fiscal_periods
    WHERE p_date BETWEEN start_date AND end_date
    AND is_closed = TRUE
    LIMIT 1;
    
    RETURN COALESCE(v_is_closed, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Trigger function to prevent journal entry changes in closed periods
CREATE OR REPLACE FUNCTION check_period_lock()
RETURNS TRIGGER AS $$
DECLARE
    v_is_closed BOOLEAN;
BEGIN
    -- For DELETE, check OLD date
    IF (TG_OP = 'DELETE') THEN
        v_is_closed := is_period_closed(OLD.entry_date);
        IF v_is_closed THEN
            RAISE EXCEPTION 'لا يمكن حذف قيد محاسبي من فترة مغلقة (تاريخ القيد: %)', OLD.entry_date;
        END IF;
        RETURN OLD;
    END IF;
    
    -- For INSERT/UPDATE, check NEW date
    v_is_closed := is_period_closed(NEW.entry_date);
    IF v_is_closed THEN
        IF (TG_OP = 'INSERT') THEN
            RAISE EXCEPTION 'لا يمكن إضافة قيد محاسبي في فترة مغلقة (تاريخ القيد: %)', NEW.entry_date;
        ELSIF (TG_OP = 'UPDATE') THEN
            RAISE EXCEPTION 'لا يمكن تعديل قيد محاسبي في فترة مغلقة (تاريخ القيد: %)', NEW.entry_date;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to journal_entries
DROP TRIGGER IF EXISTS check_journal_entry_period ON journal_entries;
CREATE TRIGGER check_journal_entry_period
BEFORE INSERT OR UPDATE OR DELETE ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION check_period_lock();

-- Function to close a fiscal period
CREATE OR REPLACE FUNCTION close_fiscal_period(
    p_period_id UUID,
    p_closed_by UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_period RECORD;
BEGIN
    -- Get period details
    SELECT * INTO v_period
    FROM fiscal_periods
    WHERE id = p_period_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Fiscal period not found';
    END IF;
    
    IF v_period.is_closed THEN
        RAISE EXCEPTION 'Period already closed';
    END IF;
    
    -- Close the period
    UPDATE fiscal_periods
    SET is_closed = TRUE,
        closed_by = p_closed_by,
        closed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_period_id;
    
    RAISE NOTICE 'Fiscal period "%" closed successfully', v_period.period_name;
END;
$$ LANGUAGE plpgsql;

-- Function to reopen a fiscal period (with caution)
CREATE OR REPLACE FUNCTION reopen_fiscal_period(p_period_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE fiscal_periods
    SET is_closed = FALSE,
        closed_by = NULL,
        closed_at = NULL,
        updated_at = NOW()
    WHERE id = p_period_id;
    
    RAISE WARNING '⚠️ Fiscal period reopened. Use with caution!';
END;
$$ LANGUAGE plpgsql;

-- Insert sample fiscal periods (optional - can be removed if not needed)
-- Example: Create monthly periods for 2026
DO $$
DECLARE
    v_month INTEGER;
    v_year INTEGER := 2026;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    FOR v_month IN 1..12 LOOP
        v_start_date := make_date(v_year, v_month, 1);
        v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
        
        INSERT INTO fiscal_periods (period_name, start_date, end_date, is_closed)
        VALUES (
            to_char(v_start_date, 'Month YYYY'),
            v_start_date,
            v_end_date,
            FALSE
        )
        ON CONFLICT (start_date, end_date) DO NOTHING;
    END LOOP;
    
    RAISE NOTICE '✓ Created 12 monthly fiscal periods for 2026';
END $$;

-- Verification
SELECT period_name, start_date, end_date, is_closed
FROM fiscal_periods
ORDER BY start_date;
