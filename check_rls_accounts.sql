-- Check RLS status and policies for accounts_v2
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'accounts_v2';

-- Check existing policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'accounts_v2';

-- If RLS is enabled but no policies exist, disable it:
-- ALTER TABLE accounts_v2 DISABLE ROW LEVEL SECURITY;

-- Or create a policy to allow all access:
-- CREATE POLICY "Enable all access for authenticated users" 
-- ON accounts_v2 FOR ALL 
-- USING (true) 
-- WITH CHECK (true);
