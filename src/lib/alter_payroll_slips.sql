
ALTER TABLE payroll_slips ADD COLUMN IF NOT EXISTS journal_entry_v2_id UUID REFERENCES journal_entries_v2(id);
