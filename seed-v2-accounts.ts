
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedAccounts() {
    console.log('🌱 Starting V2 Accounts Seeding...');

    // 1. Get Account Types
    const { data: types, error: typesError } = await supabase.from('account_types_v2').select('*');
    if (typesError || !types || types.length === 0) {
        console.error('❌ User needs to run the schema types insertion first!');
        return;
    }

    const assetType = types.find(t => t.category === 'asset')?.id;
    const liabilityType = types.find(t => t.category === 'liability')?.id;
    const equityType = types.find(t => t.category === 'equity')?.id;
    const revenueType = types.find(t => t.category === 'revenue')?.id;
    const expenseType = types.find(t => t.category === 'expense')?.id;

    if (!assetType) { console.error('Asset type missing'); return; }

    // Root Accounts
    const roots = [
        { code: '1', name_ar: 'الأصول', name_en: 'Assets', type_id: assetType, level: 1, is_group: true },
        { code: '2', name_ar: 'الخصوم', name_en: 'Liabilities', type_id: liabilityType, level: 1, is_group: true },
        { code: '3', name_ar: 'حقوق الملكية', name_en: 'Equity', type_id: equityType, level: 1, is_group: true },
        { code: '4', name_ar: 'الإيرادات', name_en: 'Revenue', type_id: revenueType, level: 1, is_group: true },
        { code: '5', name_ar: 'المصروفات', name_en: 'Expenses', type_id: expenseType, level: 1, is_group: true },
    ];

    for (const acc of roots) {
        await supabase.from('accounts_v2').upsert(acc, { onConflict: 'code' });
    }

    // Fetch IDs for parents
    const { data: accounts } = await supabase.from('accounts_v2').select('id, code');
    const getid = (c: string) => accounts?.find(a => a.code === c)?.id;

    // Level 2 & 3 Sample
    const children = [
        // Assets -> Current Assets -> Cash
        { code: '11', name_ar: 'الأصول المتداولة', name_en: 'Current Assets', type_id: assetType, parent_id: getid('1'), level: 2, is_group: true },
        { code: '111', name_ar: 'النقدية وما في حكمها', name_en: 'Cash & Equivalents', type_id: assetType, parent_id: null, level: 3, is_group: true }, // Parent ID update later
    ];

    // Correcting parent mapping dynamically would be better, but for speed:
    // Let's just insert specific leaf accounts needed for test if parents missing
    // Actually, let's just insert the keys we need for the test using a flat approach if possible, or hierarchical.

    // Quick Fix: Create the specific test accounts directly linked to roots if intermediates missing, 
    // OR just create a logical hierarchy.

    // 1. Ensure Level 1 exists (Done)
    const assetsId = getid('1');
    const revenueId = getid('4');

    // 2. Create Level 2 (Current Assets)
    const { data: ca } = await supabase.from('accounts_v2').upsert({
        code: '11', name_ar: 'أصول متداولة', name_en: 'Current Assets', type_id: assetType, parent_id: assetsId, level: 2, is_group: true
    }, { onConflict: 'code' }).select().single();

    // 3. Create Leaf: Main Treasury
    await supabase.from('accounts_v2').upsert({
        code: '1101', name_ar: 'الخزينة الرئيسية', name_en: 'Main Treasury', type_id: assetType, parent_id: ca.id, level: 3, is_group: false
    }, { onConflict: 'code' });

    // 4. Create Leaf: Inventory Sales
    await supabase.from('accounts_v2').upsert({
        code: '4201', name_ar: 'مبيعات مخزون', name_en: 'Inventory Sales', type_id: revenueType, parent_id: revenueId, level: 2, is_group: false
    }, { onConflict: 'code' });

    console.log('✅ Specific test accounts seeded.');
}

seedAccounts();
