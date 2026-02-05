'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';

export interface Payment {
    id: string;
    date: string;
    reference: string;
    payee?: string;
    paymentAccountId: string; // The Cash/Bank account PAYING money (Credit)
    paymentAccountName: string;
    description: string;
    amount: number;
    currency: 'LYD' | 'USD';
    lineItems: { accountId: string; amount: number; description?: string }[];
}

export async function createPayment(data: Omit<Payment, 'id' | 'reference'>) {
    try {
        const reference = `PAY-${Date.now().toString().slice(-6)}`;

        // 1. Create Transaction (Type = Payment)
        const { data: trx, error: trxError } = await supabaseAdmin.from('accounting_transactions').insert({
            date: data.date,
            reference: reference,
            type: 'payment',
            payee: data.payee,
            account_id: data.paymentAccountId, // Credit (Decrease Asset)
            description: data.description,
            amount: data.amount, // Stored as positive, logic handles sign
            currency: data.currency,
            line_items: data.lineItems // Debit (Expense/Liability/etc)
        }).select().single();

        if (trxError) {
            console.error('DB Error', trxError);
            return { success: false, error: 'Database error. Make sure accounting_transactions table exists.' };
        }

        // 2. Decrement Balance of the Paying Account (Cash/Bank)
        const { error: balanceError } = await supabaseAdmin.rpc('decrement_balance', {
            row_id: data.paymentAccountId,
            amount: data.amount
        });

        // Fallback (Manual Update)
        if (balanceError) {
            const { data: acc } = await supabaseAdmin.from('treasury_cards_v4').select('balance').eq('id', data.paymentAccountId).single();
            if (acc) {
                await supabaseAdmin.from('treasury_cards_v4').update({ balance: acc.balance - data.amount }).eq('id', data.paymentAccountId);
            }
        }

        revalidatePath('/admin/accounting/payments');
        revalidatePath('/admin/accounting/cash-accounts');
        revalidatePath('/admin/accounting/bank-accounts');
        return { success: true, id: trx.id };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getPayments(): Promise<Payment[]> {
    const { data, error } = await supabaseAdmin
        .from('accounting_transactions')
        .select(`
            *,
            account:account_id(name)
        `)
        .eq('type', 'payment')
        .order('date', { ascending: false })
        .limit(50);

    if (error) return [];

    return data.map((d: any) => ({
        id: d.id,
        date: d.date,
        reference: d.reference,
        payee: d.payee,
        paymentAccountId: d.account_id,
        paymentAccountName: d.account?.name || 'Unknown',
        description: d.description,
        amount: d.amount,
        currency: d.currency,
        lineItems: d.line_items
    }));
}
