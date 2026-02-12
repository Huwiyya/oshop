-- ============================================
-- Fix for Duplicate Treasury Cards
-- ============================================
-- Run this in Supabase SQL Editor to fix the duplicate cards issue

-- 1. Delete all duplicate treasury cards (keep only one of each type)
DELETE FROM treasury_cards_v4 a
USING treasury_cards_v4 b
WHERE a.id > b.id AND a.type = b.type;

-- 2. Add UNIQUE constraint on type column to prevent future duplicates
ALTER TABLE treasury_cards_v4 
ADD CONSTRAINT treasury_cards_type_unique UNIQUE (type);

-- 3. Verify - should show exactly 3 cards
SELECT 
    name as "اسم_البطاقة",
    type as "النوع",
    balance as "الرصيد",
    currency as "العملة"
FROM treasury_cards_v4 
ORDER BY type;

-- Expected result: 3 rows only (cash_dollar, cash_libyan, bank)
