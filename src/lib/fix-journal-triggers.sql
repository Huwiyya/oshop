-- ============================================
-- FIX: Remove Duplicate Journal Entry Triggers
-- ============================================

-- Problem: We found TWO triggers on journal_entry_lines:
-- 1. on_journal_entry_line_change (The correct one we defined)
-- 2. trigger_update_account_balance (Legacy trigger causing double counting)

-- Action: Drop the legacy trigger.

DROP TRIGGER IF EXISTS trigger_update_account_balance ON journal_entry_lines;
DROP TRIGGER IF EXISTS trg_update_account_balance ON journal_entry_lines; -- Just in case

-- Ensure only the correct one remains
-- We do NOT drop on_journal_entry_line_change
