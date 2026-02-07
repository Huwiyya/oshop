'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { createPaymentAtomic, updatePaymentAtomic, deleteDocumentAtomic } from './atomic-actions';

export interface Payment {
    id: string;
    date: string;
    reference: string;
    payee?: string;
    relatedUserId?: string;
    paymentAccountId: string; // The Cash/Bank account PAYING money (Credit)
    paymentAccountName: string;
    description: string;
    amount: number;
    currency: 'LYD' | 'USD';
    lineItems: { accountId: string; amount: number; description?: string }[];
}

export async function createPayment(data: Omit<Payment, 'id' | 'reference'>) {
    try {
        // Prepare Header
        const header = {
            date: data.date,
            boxAccountId: data.paymentAccountId, // The Credit Account (Cash/Bank) - Payer
            notes: data.description,
            supplier_id: data.relatedUserId || null,
            payee_name: data.payee || null
        };

        // Prepare Lines (Debit Accounts - Expenses)
        let lines: any[] = [];
        if (data.lineItems && data.lineItems.length > 0) {
            lines = data.lineItems.map(item => ({
                accountId: item.accountId,
                amount: item.amount,
                description: item.description || data.description
            }));
        } else {
            throw new Error('يجب تحديد بنود الصرف');
        }

        const result = await createPaymentAtomic(header, lines);

        revalidatePath('/accounting/payments');
        revalidatePath('/accounting/dashboard');
        revalidatePath('/accounting/cash-bank');

        return { success: true, id: result.id };

    } catch (e: any) {
        console.error('Create Payment Error:', e);
        return { success: false, error: e.message };
    }
}

export async function getPaymentById(id: string): Promise<Payment | null> {
    try {
        const { data, error } = await supabaseAdmin
            .from('payments')
            .select(`
                *,
                bank_account:accounts!bank_account_id(id, name_ar, name_en, account_code, currency),
                lines:payment_lines(*)
            `)
            .eq('id', id)
            .single();

        if (error || !data) {
            console.error('Error fetching payment:', error);
            return null;
        }

        const lineItems = data.lines?.map((l: any) => ({
            accountId: l.account_id,
            amount: l.amount,
            description: l.description
        })) || [];

        return {
            id: data.id,
            date: data.payment_date,
            reference: data.payment_number,
            payee: data.payee_name || (data.supplier_id ? `مورد ${data.supplier_id}` : '-'),
            relatedUserId: data.supplier_id,
            paymentAccountId: data.bank_account_id,
            paymentAccountName: data.bank_account?.name_ar || data.bank_account?.name_en || 'غير محدد',
            description: data.main_description,
            amount: data.total_amount,
            currency: (data.bank_account?.currency || 'LYD') as 'LYD' | 'USD',
            lineItems: lineItems
        };
    } catch (e) {
        console.error('Error fetching payment:', e);
        return null;
    }
}

export async function getPayments(filters?: { query?: string; startDate?: string; endDate?: string }): Promise<Payment[]> {
    let query = supabaseAdmin
        .from('payments')
        .select(`
            *,
            bank_account:accounts!bank_account_id(id, name_ar, name_en, account_code)
        `)
        .order('payment_date', { ascending: false });

    if (filters?.startDate) query = query.gte('payment_date', filters.startDate);
    if (filters?.endDate) query = query.lte('payment_date', filters.endDate);
    if (filters?.query) {
        query = query.or(`main_description.ilike.%${filters.query}%,payment_number.ilike.%${filters.query}%`);
    }

    const { data, error } = await query.limit(50);

    if (error) {
        console.error('Error fetching payments:', error);
        return [];
    }

    return data.map((d: any) => ({
        id: d.id,
        date: d.payment_date,
        reference: d.payment_number,
        payee: d.payee_name || (d.supplier_id ? `مورد ${d.supplier_id}` : '-'),
        paymentAccountId: d.bank_account_id,
        paymentAccountName: d.bank_account?.name_ar || d.bank_account?.name_en || 'غير محدد',
        description: d.main_description,
        amount: d.total_amount,
        currency: 'LYD',
        lineItems: []
    }));
}

export async function deletePayment(id: string) {
    try {
        await deleteDocumentAtomic(id, 'payment');

        revalidatePath('/accounting/payments');
        revalidatePath('/accounting/dashboard');
        revalidatePath('/accounting/cash-bank');

        return { success: true };
    } catch (e: any) {
        console.error('Delete Payment Error:', e);
        return { success: false, error: e.message };
    }
}

export async function updatePayment(id: string, data: Omit<Payment, 'id' | 'reference'>) {
    try {
        // Prepare Header
        const header = {
            date: data.date,
            boxAccountId: data.paymentAccountId,
            notes: data.description,
            supplier_id: data.relatedUserId || null,
            payee_name: data.payee || null
        };

        // Prepare Lines
        let lines: any[] = [];
        if (data.lineItems && data.lineItems.length > 0) {
            lines = data.lineItems.map(item => ({
                accountId: item.accountId,
                amount: item.amount,
                description: item.description || data.description
            }));
        } else {
            throw new Error('يجب تحديد بنود الصرف');
        }

        await updatePaymentAtomic(id, header, lines);

        revalidatePath('/accounting/payments');
        revalidatePath('/accounting/dashboard');
        revalidatePath('/accounting/cash-bank');

        return { success: true };
    } catch (e: any) {
        console.error('Update Payment Error:', e);
        return { success: false, error: e.message };
    }
}
