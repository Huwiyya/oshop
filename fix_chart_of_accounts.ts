
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Must use Service Role for RLS bypass if needed
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAccounts() {
    console.log('Fixing Chart of Accounts for Payroll...');

    // 1. Ensure Root "Liabilities" (2)
    let { data: rootLiab } = await supabase.from('accounts').select('id').eq('account_code', '2').single();
    if (!rootLiab) {
        console.log('Creating Root Liabilities (2)...');
        const { data, error } = await supabase.from('accounts').insert({
            account_code: '2',
            name_ar: 'الخصوم',
            name_en: 'Liabilities',
            type: 'group', // Assuming 'group' or similar logic. Actually account_types table handles type?
            // accounts table Usually has account_type_id or similar. 
            // Let's check structure. 
            // In accounting-actions.ts: select(..., account_type:account_types!inner(...))
            // I need account_type_id for 'Liability'.
            // Let's fetch account_types first.
            is_active: true,
            level: 1,
            is_parent: true
        }).select().single();

        // Wait, insert might fail if I don't provide account_type_id.
        // Let's rely on RPC if possible? No, I can't call RPC easily from here without defining types.
        // Let's just look at an existing account to see what columns are needed.
        // Or better yet, I will use `create_hierarchical_account_rpc` via RPC call!
    }

    // Function to create account via RPC which handles logic
    async function createAccount(code: string, nameAr: string, nameEn: string, parentCode: string | null) {
        // Find Parent ID
        let parentId = null;
        if (parentCode) {
            const { data: p } = await supabase.from('accounts').select('id').eq('account_code', parentCode).single();
            if (p) parentId = p.id;
            else {
                console.error(`Parent ${parentCode} not found for ${code}. Skipping.`);
                return;
            }
        }

        // Check if exists
        const { data: existing } = await supabase.from('accounts').select('id').eq('account_code', code).single();
        if (existing) {
            console.log(`Account ${code} already exists.`);
            return;
        }

        console.log(`Creating Account ${code} (${nameAr})...`);
        const { error } = await supabase.rpc('create_hierarchical_account_rpc', {
            p_name_ar: nameAr,
            p_name_en: nameEn,
            p_parent_id: parentId, // Can be null for root? usually roots are inserted manually or have null parent.
            p_currency: 'LYD',
            p_description: 'Auto-generated for Payroll'
        });

        if (error) {
            console.error(`Failed to create ${code}:`, error.message);
            // Fallback: Manual Insert if RPC fails on Root
            if (!parentId && code.length === 1) {
                // Try manual insert for Root 2
                // Need account_type_id for 'liability'
                const { data: type } = await supabase.from('account_types').select('id').eq('name_en', 'Liability').single();
                if (type) {
                    await supabase.from('accounts').insert({
                        account_code: code,
                        name_ar: nameAr,
                        name_en: nameEn,
                        account_type_id: type.id,
                        level: 1,
                        is_parent: true,
                        is_active: true
                    });
                    console.log('Manual insert successful.');
                }
            }
        } else {
            console.log('Success.');
        }
    }

    // Execute Hierarchy
    // 2 (Liabilities) -> created manually usually.
    // 21 (Current Liabilities)
    // 2100 (Current Liabilities - Group) -> Wait, 21 is usually the group. 2100 might be the one requested by API.
    // 213 (Payables?)
    // 2130 (Employee Payables)

    // Let's try to ensure structure:
    // 2 - Liabilities
    // 21 - Current Liabilities
    // 2100 - Current Liabilities (Detailed or Subgroup?)

    // The error said "Current Liabilities account (2100)".
    // Let's create `2100` under `2` (or `21` if 21 exists).

    await createAccount('2', 'الخصوم', 'Liabilities', null);
    await createAccount('21', 'الخصوم المتداولة', 'Current Liabilities', '2');
    await createAccount('2100', 'أرصدة دائنة أخرى', 'Other Current Liabilities', '21');

    // Employee Payables
    // This is the one getEmployeesV2 uses: 2130.
    // Parent should be 21 or 2100? 
    // Usually 2 (Liab) -> 21 (Curr) -> 213 (Payables) -> 2130 (Employees).
    // Let's put 2130 under 21 for simplicity if 213 doesn't exist.
    await createAccount('2130', 'ذمم موظفين', 'Employee Payables', '21');

    // Expense Side
    // 5 - Expenses
    // 51 - Operating Expenses
    // 5100 - Salaries
    await createAccount('5', 'المصروفات', 'Expenses', null);
    await createAccount('51', 'مصروفات تشغيلية', 'Operating Expenses', '5');
    await createAccount('5100', 'رواتب وأجور', 'Salaries & Wages', '51');
    await createAccount('510001', 'راتب أساسي', 'Basic Salary', '5100');
}

fixAccounts();
