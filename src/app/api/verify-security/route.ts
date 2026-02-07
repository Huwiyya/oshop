import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export async function GET() {
    const steps = [];
    let jeId = null;
    let invoiceId = null;

    try {
        // 1. Create a Dummy Journal Entry (Posted)
        const { data: je, error: jeError } = await supabaseAdmin.rpc('create_journal_entry_rpc', {
            entry_date: new Date().toISOString(),
            description: 'Test Security JE',
            ref_type: 'manual',
            ref_id: 'SEC-' + Date.now(),
            lines: [] // Empty ok? Validations usually require balanced lines.
            // Let's create a valid one.
            // Need accounts.
        });

        // Simpler: Insert directly to avoid RPC complexity if we just want to test triggers.
        // But RPC is safer.
        // Let's use direct insert for setup speed, assuming we have accounts.
        // Or re-use RPC if possible.
        // Direct Insert:
        const { data: jeDirect, error: jeDirectError } = await supabaseAdmin.from('journal_entries').insert({
            entry_number: 'SEC-JE-' + Date.now(),
            description: 'Security Test',
            status: 'posted',
            total_debit: 100,
            total_credit: 100
        }).select().single();

        if (jeDirectError || !jeDirect) throw new Error('Setup JE Failed: ' + jeDirectError?.message);
        jeId = jeDirect.id;
        steps.push({ msg: 'Posted JE Created', id: jeId });

        // 2. Attempt Direct UPDATE of Amount (Should Fail)
        const { error: updateError } = await supabaseAdmin.from('journal_entries')
            .update({ total_debit: 200 })
            .eq('id', jeId);

        if (updateError) {
            steps.push({ msg: 'Direct Update Blocked (Success)', error: updateError.message });
        } else {
            throw new Error('Direct Update succeeded! Security Trigger Failed.');
        }

        // 3. Attempt Direct DELETE (Should Succeed based on current policy for Manager Editing)
        // Or are we checking Invoice deletion safety?
        // Let's test Invoice Safety.

        // Create Dummy Invoice linked to this JE
        const { data: inv, error: invError } = await supabaseAdmin.from('sales_invoices').insert({
            invoice_number: 'SEC-INV-' + Date.now(),
            total_amount: 100,
            journal_entry_id: jeId
        }).select().single();

        if (invError || !inv) throw new Error('Setup Invoice Failed: ' + invError?.message);
        invoiceId = inv.id;
        steps.push({ msg: 'Invoice Created linked to JE', id: invoiceId });

        // 4. Attempt Direct DELETE of Invoice (Should Fail because JE exists)
        const { error: delInvError } = await supabaseAdmin.from('sales_invoices').delete().eq('id', invoiceId);

        if (delInvError) {
            steps.push({ msg: 'Direct Invoice Delete Blocked (Success)', error: delInvError.message });
        } else {
            // Verify if it was actually deleted
            const { data: checkInv } = await supabaseAdmin.from('sales_invoices').select('id').eq('id', invoiceId).single();
            if (!checkInv) throw new Error('Direct Invoice Delete succeeded! Orphan Check Trigger Failed.');
            steps.push({ msg: 'Invoice Delete Blocked (No Error but Row Exists?)', check: checkInv });
        }

        // 5. Cleanup (Using RPC logic or careful delete)
        // Delete Trigger allows delete if JE is gone.
        // So Delete JE first (Allowed), then Delete Invoice.
        await supabaseAdmin.from('journal_entries').delete().eq('id', jeId);
        steps.push({ msg: 'JE Deleted Manually (Allowed)' });

        await supabaseAdmin.from('sales_invoices').delete().eq('id', invoiceId);
        steps.push({ msg: 'Invoice Deleted after JE removal' });

        return NextResponse.json({ success: true, steps });

    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message, steps });
    }
}
