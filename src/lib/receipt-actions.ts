'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { createReceiptAtomic, updateReceiptAtomic, deleteDocumentAtomic } from './atomic-actions';

export interface Receipt {
    id: string;
    date: string;
    reference: string;
    payer?: string;
    relatedUserId?: string; // Link to specific user
    receiveAccountId: string; // The Cash/Bank account receiving money (Debit)
    receiveAccountName: string;
    creditAccountId?: string; // The Account paying (Credit) - Customer or Revenue
    creditAccountName?: string;
    description: string;
    amount: number;
    currency: 'LYD' | 'USD';
    lineItems: { accountId: string; amount: number; description?: string }[];
}

// We need a place to store these transactions.
// Plan: Create 'accounting_transactions' table later.
// For now, we will use the same 'journal_entries' but with a specific type flag or just dedicated table.
// Let's stick to the plan: `accounting_transactions`.

// ... Keep Interface Receipt ...

// We need a place to store these transactions.
// Plan: Create 'accounting_transactions' table later.
// For now, we will use the same 'journal_entries' but with a specific type flag or just dedicated table.
// Let's stick to the plan: `accounting_transactions`.

export async function createReceipt(data: Omit<Receipt, 'id' | 'reference'>) {
    try {
        // Prepare Header
        const header = {
            date: data.date,
            boxAccountId: data.receiveAccountId, // The Debit Account (Cash/Bank)
            notes: data.description
        };

        // Prepare Lines (Credit Accounts)
        let lines: any[] = [];
        if (data.lineItems && data.lineItems.length > 0) {
            lines = data.lineItems.map(item => ({
                accountId: item.accountId,
                amount: item.amount,
                description: item.description || data.description
            }));
        } else if (data.creditAccountId) {
            // Legacy/Single-line fallback
            lines.push({
                accountId: data.creditAccountId,
                amount: data.amount,
                description: data.description
            });
        } else {
            throw new Error('يجب تحديد بنود السند أو الحساب الدائن');
        }

        const result = await createReceiptAtomic(header, lines);

        revalidatePath('/accounting/receipts');
        revalidatePath('/accounting/dashboard');
        revalidatePath('/accounting/cash-bank');

        // RPC returns { success: true, id: ..., number: ... }
        // We match the return type expected by UI
        return { success: true, id: result.id };

    } catch (e: any) {
        console.error('Create Receipt Error:', e);
        return { success: false, error: e.message };
    }
}

export async function getReceiptById(id: string) {
    try {
        const { data, error } = await supabaseAdmin
            .from('receipts')
            .select(`
                *,
                bank_account:accounts!bank_account_id(id, name_ar, name_en, account_code, currency),
                lines:receipt_lines(*)
            `)
            .eq('id', id)
            .single();

        if (error || !data) {
            return null;
        }

        // Fetch lines if joined, or fetch separately if needed
        // The query above fetches lines:receipt_lines(*)

        const lineItems = data.lines?.map((l: any) => ({
            accountId: l.account_id,
            amount: l.amount,
            description: l.description
        })) || [];

        return {
            id: data.id,
            date: data.receipt_date,
            reference: data.receipt_number,
            payer: data.customer_id ? `عميل ${data.customer_id}` : '-',
            relatedUserId: data.customer_id,
            receiveAccountId: data.bank_account_id,
            receiveAccountName: data.bank_account?.name_ar || data.bank_account?.name_en || 'غير محدد',
            description: data.main_description,
            amount: data.total_amount,
            currency: (data.bank_account?.currency || 'LYD') as 'LYD' | 'USD',
            lineItems: lineItems,
            creditAccountId: lineItems.length === 1 ? lineItems[0].accountId : undefined // For legacy compatibility
        };
    } catch (e) {
        console.error('Error fetching receipt:', e);
        return null;
    }
}

export async function getReceipts(filters?: { query?: string; startDate?: string; endDate?: string }): Promise<Receipt[]> {
    let query = supabaseAdmin
        .from('receipts')
        .select(`
            *,
            bank_account:accounts!bank_account_id(id, name_ar, name_en, account_code)
        `)
        .order('receipt_date', { ascending: false });

    if (filters?.startDate) {
        query = query.gte('receipt_date', filters.startDate);
    }
    if (filters?.endDate) {
        query = query.lte('receipt_date', filters.endDate);
    }
    if (filters?.query) {
        // Search in main_description, receipt_number
        query = query.or(`main_description.ilike.%${filters.query}%,receipt_number.ilike.%${filters.query}%`);
    }

    const { data, error } = await query.limit(50);

    if (error) {
        console.error('Error fetching receipts:', error);
        return [];
    }

    return data.map((d: any) => ({
        id: d.id,
        date: d.receipt_date,
        reference: d.receipt_number,
        payer: d.customer_id ? `عميل ${d.customer_id}` : '-',
        receiveAccountId: d.bank_account_id,
        receiveAccountName: d.bank_account?.name_ar || d.bank_account?.name_en || 'غير محدد',
        description: d.main_description,
        amount: d.total_amount,
        currency: 'LYD',
        lineItems: [] // Optimization: Don't load lines for list view unless needed
    }));
}

export async function deleteReceipt(id: string) {
    try {
        await deleteDocumentAtomic(id, 'receipt');

        revalidatePath('/accounting/receipts');
        revalidatePath('/accounting/dashboard');
        revalidatePath('/accounting/cash-bank');

        return { success: true };
    } catch (e: any) {
        console.error('Delete Receipt Error:', e);
        return { success: false, error: e.message };
    }
}

export async function updateReceipt(id: string, data: Omit<Receipt, 'id' | 'reference'>) {
    try {
        // Prepare Header
        const header = {
            date: data.date,
            boxAccountId: data.receiveAccountId,
            notes: data.description
        };

        // Prepare Lines
        let lines: any[] = [];
        if (data.lineItems && data.lineItems.length > 0) {
            lines = data.lineItems.map(item => ({
                accountId: item.accountId,
                amount: item.amount,
                description: item.description || data.description
            }));
        } else if (data.creditAccountId) {
            lines.push({
                accountId: data.creditAccountId,
                amount: data.amount,
                description: data.description
            });
        } else {
            throw new Error('يجب تحديد بنود السند');
        }

        await updateReceiptAtomic(id, header, lines);

        revalidatePath('/accounting/receipts');
        revalidatePath('/accounting/dashboard');
        revalidatePath('/accounting/cash-bank');

        return { success: true };
    } catch (e: any) {
        console.error('Update Receipt Error:', e);
        return { success: false, error: e.message };
    }
}
