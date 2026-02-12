-- Find group accounts that have journal lines directly linked to them
SELECT 
    a.id, 
    a.name_ar, 
    a.code, 
    a.current_balance,
    COUNT(jl.id) as line_count,
    SUM(jl.debit) as total_debit,
    SUM(jl.credit) as total_credit
FROM accounts_v2 a
JOIN journal_lines_v2 jl ON a.id = jl.account_id
WHERE a.is_group = true
GROUP BY a.id, a.name_ar, a.code, a.current_balance;
