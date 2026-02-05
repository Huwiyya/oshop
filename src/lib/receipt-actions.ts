'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';

export interface Receipt {
    id: string;
    date: string;
    reference: string;
    payer?: string;
    relatedUserId?: string; // Link to specific user
    receiveAccountId: string; // The Cash/Bank account receiving money
    receiveAccountName: string;
    description: string;
    amount: number;
    currency: 'LYD' | 'USD';
    lineItems: { accountId: string; amount: number; description?: string }[];
}

// We need a place to store these transactions. 
// Plan: Create 'accounting_transactions' table later. 
// For now, we will use the same 'journal_entries' but with a specific type flag or just dedicated table.
// Let's stick to the plan: `accounting_transactions`.

export async function createReceipt(data: Omit<Receipt, 'id' | 'reference'>) {
    try {
        const reference = `REC-${Date.now().toString().slice(-6)}`;

        // 1. Create Transaction Record
        const { data: trx, error: trxError } = await supabaseAdmin.from('accounting_transactions').insert({
            date: data.date,
            reference: reference,
            type: 'receipt',
            payer: data.payer,
            related_user_id: data.relatedUserId, // Save the link
            account_id: data.receiveAccountId, // Debit (Increase Asset)
            description: data.description,
            amount: data.amount,
            currency: data.currency,
            line_items: data.lineItems // Credit (Income/Equity/etc)
        }).select().single();

        if (trxError) {
            // If table doesn't exist, we fallback to error. User needs to run SQL.
            console.error('DB Error', trxError);
            return { success: false, error: 'Database error. Make sure accounting_transactions table exists.' };
        }

        // 2. Update Balance of the Receiving Account (Cash/Bank)
        // We use rpc or manual update.
        // Assuming 'treasury_cards_v4' holds the balance.
        const { error: balanceError } = await supabaseAdmin.rpc('increment_balance', {
            row_id: data.receiveAccountId,
            amount: data.amount
        });

        // Fallback if RPC missing (manual update - risky concurrency but okay for prototype)
        if (balanceError) {
            const { data: acc } = await supabaseAdmin.from('treasury_cards_v4').select('balance').eq('id', data.receiveAccountId).single();
            if (acc) {
                await supabaseAdmin.from('treasury_cards_v4').update({ balance: acc.balance + data.amount }).eq('id', data.receiveAccountId);
            }
        }

        revalidatePath('/admin/accounting/receipts');
        revalidatePath('/admin/accounting/cash-accounts');
        revalidatePath('/admin/accounting/bank-accounts');
        return { success: true, id: trx.id };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getReceipts(): Promise<Receipt[]> {
    const { data, error } = await supabaseAdmin
        .from('accounting_transactions')
        .select(`
            *,
            account:account_id(name)
        `)
        .eq('type', 'receipt')
        .order('date', { ascending: false })
        .limit(50);

    if (error) return [];

    return data.map((d: any) => ({
        id: d.id,
        date: d.date,
        reference: d.reference,
        payer: d.payer,
        receiveAccountId: d.account_id,
        receiveAccountName: d.account?.name || 'Unknown',
        description: d.description,
        amount: d.amount,
        currency: d.currency,
        lineItems: d.line_items
    }));
}
