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

async function verifyFixedAssetsFlow() {
    console.log('🧪 Starting Fixed Assets V2 Verification...');

    // 1. Setup Accounts
    // Asset (Vehicle), Expense (Depreciation), Contra-Asset (Accum Dep)
    let assetAccId, expenseAccId, accumDepAccId;

    // Get/Create Asset Account
    const { data: assetAcc } = await supabase.from('accounts_v2').select('*').eq('name_en', 'Vehicles').single();
    if (assetAcc) assetAccId = assetAcc.id;
    else {
        const { data: type } = await supabase.from('account_types_v2').select('id').eq('name_en', 'Assets').single();
        const { data: newAcc } = await supabase.from('accounts_v2').insert({
            code: '1105', name_ar: 'سيارات', name_en: 'Vehicles', type_id: type.id, level: 3
        }).select().single();
        assetAccId = newAcc.id;
    }

    // Get/Create Expense Account
    const { data: expAcc } = await supabase.from('accounts_v2').select('*').eq('name_en', 'Depreciation Expense').single();
    if (expAcc) expenseAccId = expAcc.id;
    else {
        const { data: type } = await supabase.from('account_types_v2').select('id').eq('name_en', 'Expenses').single();
        const { data: newAcc } = await supabase.from('accounts_v2').insert({
            code: '5201', name_ar: 'مصروف إهلاك', name_en: 'Depreciation Expense', type_id: type.id, level: 3
        }).select().single();
        expenseAccId = newAcc.id;
    }

    // Get/Create Accum Dep Account
    const { data: accumAcc } = await supabase.from('accounts_v2').select('*').eq('name_en', 'Accumulated Depreciation - Vehicles').single();
    if (accumAcc) accumDepAccId = accumAcc.id;
    else {
        // Usually contra-asset, but let's just put it under Assets for now or logic check
        const { data: type } = await supabase.from('account_types_v2').select('id').eq('name_en', 'Assets').single();
        const { data: newAcc } = await supabase.from('accounts_v2').insert({
            code: '1106', name_ar: 'مجمع إهلاك سيارات', name_en: 'Accumulated Depreciation - Vehicles', type_id: type.id, level: 3
        }).select().single();
        accumDepAccId = newAcc.id;
    }

    console.log('✅ Accounts ready:', { assetAccId, expenseAccId, accumDepAccId });

    // 2. Create Asset
    console.log('📝 Creating Fixed Asset...');
    const { data: asset, error: assetError } = await supabase.from('fixed_assets_v2').insert({
        asset_number: `AST-${Date.now()}`,
        name_ar: 'سيارة تجربة',
        name_en: 'Test Vehicle',
        acquisition_date: new Date().toISOString(),
        cost: 50000,
        salvage_value: 5000,
        useful_life_years: 5,
        asset_account_id: assetAccId,
        accumulated_depreciation_account_id: accumDepAccId,
        depreciation_expense_account_id: expenseAccId,
        status: 'active'
    }).select().single();

    if (assetError) {
        console.error('❌ Failed to create asset:', assetError);
        return;
    }
    console.log('✅ Asset created:', asset.asset_number);

    // 3. Run Depreciation (Manual Entry)
    console.log('📉 Running Depreciation...');
    const depAmount = 1000;
    const { data: depEntry, error: depError } = await supabase.from('depreciation_entries_v2').insert({
        asset_id: asset.id,
        date: new Date().toISOString(),
        amount: depAmount,
        description: 'Test Depreciation',
        status: 'posted' // auto-trigger
    }).select().single();

    if (depError) {
        console.error('❌ Failed to run depreciation:', depError);
        return;
    }

    // 4. Verify Journal
    console.log('🔍 Check Journal Entry...');
    const { data: updatedDep } = await supabase.from('depreciation_entries_v2').select('journal_entry_id').eq('id', depEntry.id).single();

    if (!updatedDep.journal_entry_id) {
        console.error('❌ Journal Entry ID not found on depreciation entry! Trigger failed?');
        return;
    }

    const { data: journal } = await supabase.from('journal_entries_v2').select('*, lines:journal_lines_v2(*)').eq('id', updatedDep.journal_entry_id).single();

    if (!journal) {
        console.error('❌ Journal Entry record missing!');
        return;
    }

    console.log('✅ Journal Entry created:', journal.entry_number);

    const debitLine = journal.lines.find((l: any) => l.debit > 0);
    const creditLine = journal.lines.find((l: any) => l.credit > 0);

    if (debitLine.account_id === expenseAccId && creditLine.account_id === accumDepAccId && debitLine.debit === depAmount) {
        console.log('🎉 SUCCESS: Depreciation -> Journal Flow verified!');
    } else {
        console.error('⚠️ FAILURE: Journal lines do not match expectation.');
        console.log('Expected Debit Expense:', expenseAccId, 'Got:', debitLine?.account_id);
        console.log('Expected Credit AccumDep:', accumDepAccId, 'Got:', creditLine?.account_id);
    }

    // 5. Verify Asset Update
    const { data: updatedAsset } = await supabase.from('fixed_assets_v2').select('accumulated_depreciation').eq('id', asset.id).single();
    if (updatedAsset.accumulated_depreciation === depAmount) {
        console.log('🎉 SUCCESS: Asset Accumulated Depreciation updated!');
    } else {
        console.error('⚠️ FAILURE: Asset Accum Dep not updated. Expected:', depAmount, 'Got:', updatedAsset.accumulated_depreciation);
    }
}

verifyFixedAssetsFlow();
