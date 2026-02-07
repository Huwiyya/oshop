
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
    let report: any = { status: 'initializing', steps: [] };
    const log = (msg: string, data?: any) => report.steps.push({ msg, data: data ? JSON.stringify(data) : null });

    try {
        // 1. Setup Data
        const { data: types } = await supabaseAdmin.from('account_types').select('id, name_en');
        const liabilityType = types?.find(t => t.name_en?.toLowerCase().includes('liab'))?.id || types?.[0]?.id;
        const assetType = types?.find(t => t.name_en?.toLowerCase().includes('asset'))?.id || types?.[0]?.id;
        const expType = types?.find(t => t.name_en?.toLowerCase().includes('exp'))?.id || types?.[0]?.id;

        // Accounts
        const boxCode = 'BOX-TEST-' + Date.now().toString().slice(-4);
        const { data: boxAcc } = await supabaseAdmin.from('accounts').insert({
            account_code: boxCode, name_ar: 'خزينة تجربة', account_type_id: assetType, level: 4
        }).select().single();

        const revCode = 'REV-TEST-' + Date.now().toString().slice(-4);
        const { data: revAcc } = await supabaseAdmin.from('accounts').insert({
            account_code: revCode, name_ar: 'إيراد متنوع', account_type_id: liabilityType, level: 4
        }).select().single();

        const expCode = 'EXP-TEST-' + Date.now().toString().slice(-4);
        const { data: expAcc } = await supabaseAdmin.from('accounts').insert({
            account_code: expCode, name_ar: 'مصروف متنوع', account_type_id: expType, level: 4
        }).select().single();

        if (!boxAcc || !revAcc || !expAcc) throw new Error('Failed to create test accounts');

        log('Setup Complete', { boxCode, revCode, expCode });

        // 2. Create Receipt (Multi-line)
        log('Creating Receipt');
        const { data: receipt, error: rErr } = await supabaseAdmin.rpc('create_receipt_rpc', {
            p_header: { date: new Date().toISOString().split('T')[0], boxAccountId: boxAcc?.id, notes: 'Test Receipt' },
            p_lines: [
                { accountId: revAcc?.id, amount: 100, description: 'Revenue 1' },
                { accountId: revAcc?.id, amount: 50, description: 'Revenue 2' }
            ]
        });
        if (rErr) throw new Error('Create Receipt Failed: ' + rErr.message);
        log('Receipt Created', receipt);

        // Debug: Check Triggers
        const { data: triggers } = await supabaseAdmin.rpc('get_table_triggers', { p_table_name: 'journal_entry_lines' });
        log('Triggers on journal_entry_lines', triggers);

        const { data: rTriggers } = await supabaseAdmin.rpc('get_table_triggers', { p_table_name: 'receipt_lines' });
        log('Triggers on receipt_lines', rTriggers);

        // Debug: Check JEs
        const { data: jes } = await supabaseAdmin.from('journal_entries').select('*, journal_entry_lines(*)').eq('reference_id', receipt?.number);
        log('JEs for Receipt', jes);

        // Verify Balance (Box should increase by 150)
        const { data: boxAfterRec } = await supabaseAdmin.from('accounts').select('current_balance').eq('id', boxAcc?.id).single();
        log('Box Balance after Receipt', boxAfterRec?.current_balance);

        // 3. Create Payment (Multi-line)
        log('Creating Payment');
        const { data: payment, error: pErr } = await supabaseAdmin.rpc('create_payment_rpc', {
            p_header: { date: new Date().toISOString().split('T')[0], boxAccountId: boxAcc?.id, notes: 'Test Payment' },
            p_lines: [
                { accountId: expAcc?.id, amount: 20, description: 'Expense 1' },
                { accountId: expAcc?.id, amount: 30, description: 'Expense 2' }
            ]
        });
        if (pErr) throw new Error('Create Payment Failed: ' + pErr.message);
        log('Payment Created', payment);

        // Verify Balance (Box should decrease by 50 -> Net +100)
        const { data: boxAfterPay } = await supabaseAdmin.from('accounts').select('current_balance').eq('id', boxAcc?.id).single();
        log('Box Balance after Payment', boxAfterPay?.current_balance);

        // 4. Delete Payment
        log('Deleting Payment (Atomic)', payment?.id);
        const { data: del, error: dErr } = await supabaseAdmin.rpc('delete_document_rpc', {
            p_id: payment?.id,
            p_type: 'payment'
        });
        if (dErr) throw new Error('Delete Payment Failed: ' + dErr.message);

        // Verify Balance (Should return to +150)
        const { data: boxAfterDel } = await supabaseAdmin.from('accounts').select('current_balance').eq('id', boxAcc?.id).single();
        log('Box Balance after Delete', boxAfterDel?.current_balance);

        if (Math.abs((boxAfterDel?.current_balance || 0) - 150) > 0.1) throw new Error('Balance mismatch after delete');

        report.final_status = 'Success';
        return NextResponse.json({ success: true, report });

    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message, report }, { status: 500 });
    }
}
