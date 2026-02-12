-- =============================================
-- Fix Users Table Schema
-- =============================================
-- Run this script FIRST to ensure all columns exist before importing data.

BEGIN;

-- 1. Add walletBalance if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'walletBalance') THEN
        ALTER TABLE public.users ADD COLUMN "walletBalance" DECIMAL(10,2) DEFAULT 0.00;
    END IF;
END $$;

-- 2. Add created_at if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'created_at') THEN
        ALTER TABLE public.users ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 3. Add deleted_at if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'deleted_at') THEN
        ALTER TABLE public.users ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    END IF;
END $$;

-- 4. Add updated_at if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'updated_at') THEN
        ALTER TABLE public.users ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

COMMIT;

SELECT 'Schema updated successfully. You can now run the import script.' as status;
