
SELECT * FROM journal_entries_v2 WHERE description LIKE 'Test Edit V2%';
SELECT * FROM journal_lines_v2 WHERE journal_id IN (SELECT id FROM journal_entries_v2 WHERE description LIKE 'Test Edit V2%');
