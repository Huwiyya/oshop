-- Check accounts_v2 count
SELECT count(*) as accounts_v2_count FROM public.accounts_v2;

-- Check for Control Accounts in V2
SELECT id, code, name_ar, name_en FROM public.accounts_v2 
WHERE code IN ('1120', '2110', '112001', '112002', '211001', '211002');


