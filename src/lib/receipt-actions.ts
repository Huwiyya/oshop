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

import { createJournalEntry } from './journal-actions';

export async function createReceipt(data: Omit<Receipt, 'id' | 'reference'>) {
    try {
        // 1. إنشاء قيد اليومية (The Source of Truth)
        // المدين: حساب القبض (Cash/Bank) - زيادة أصول
        // الدائن: حساب الإيرادات أو العميل - زيادة إيرادات أو تسديد ذمة
        const journalDate = new Date(data.date);

        const journalEntry = await createJournalEntry({
            date: journalDate.toISOString(),
            description: data.description,
            lines: [
                {
                    accountId: data.receiveAccountId,
                    debit: data.amount,
                    credit: 0,
                    description: data.description
                },
                {
                    accountId: data.receiveAccountId,
                    debit: 0,
                    credit: data.amount,
                    description: data.description
                }
            ]
        });

        if (!journalEntry.success || !journalEntry.entry) {
            throw new Error('Failed to create journal entry');
        }

        // 2. إضافة سطور القيد
        // Line 1: Debit Cash/Bank Account
        await supabaseAdmin.from('journal_lines').insert({
            journal_entry_id: journalEntry.entry.id,
            account_id: data.receiveAccountId,
            debit: data.amount,
            credit: 0,
            description: data.description
        });

        // Line 2: Credit Revenue/Customer Account (simplified - using same account for now)
        await supabaseAdmin.from('journal_lines').insert({
            journal_entry_id: journalEntry.entry.id,
            account_id: data.receiveAccountId, // TODO: Should be revenue or customer account
            debit: 0,
            credit: data.amount,
            description: data.description
        });

        // 3. إنشاء سند القبض
        const receiptNumber = `REC-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

        const { data: newReceipt, error: receiptError } = await supabaseAdmin
            .from('receipts')
            .insert({
                receipt_number: receiptNumber,
                receipt_date: data.date,
                customer_id: data.relatedUserId || null,
                total_amount: data.amount,
                payment_method: 'cash', // or 'bank_transfer' based on account type
                bank_account_id: data.receiveAccountId,
                main_description: data.description,
                status: 'confirmed',
                journal_entry_id: journalEntry.entry.id
            })
            .select()
            .single();

        if (receiptError || !newReceipt) {
            throw new Error('Failed to create receipt record');
        }

        // 4. Update account balance (if needed - may be handled by triggers)
        // This is optional if you have database triggers
        if (data.receiveAccountId) {
            const { data: acc } = await supabaseAdmin.from('accounts').select('current_balance').eq('id', data.receiveAccountId).single();
            if (acc) {
                await supabaseAdmin.from('accounts').update({
                    current_balance: Number(acc.current_balance) + Number(data.amount)
                }).eq('id', data.receiveAccountId);
            }
        }

        revalidatePath('/accounting/receipts');
        revalidatePath('/accounting/dashboard');
        revalidatePath('/accounting/cash-bank');
        return { success: true, id: newReceipt.id };

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
                bank_account:accounts!bank_account_id(id, name_ar, name_en, account_code, currency)
            `)
            .eq('id', id)
            .single();

        if (error || !data) {
            return null;
        }

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
            lineItems: []
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
        lineItems: []
    }));
}

export async function deleteReceipt(id: string) {
    try {
        // 1. جلب السند للحصول على معرف القيد اليومي
        const { data: receipt, error: fetchError } = await supabaseAdmin
            .from('receipts')
            .select('journal_entry_id')
            .eq('id', id)
            .single();

        if (fetchError || !receipt) {
            throw new Error('لم يتم العثور على سند القبض');
        }

        // 2. حذف القيد اليومي المرتبط أولاً (بسبب foreign key)
        if (receipt.journal_entry_id) {
            const { error: journalError } = await supabaseAdmin
                .from('journal_entries')
                .delete()
                .eq('id', receipt.journal_entry_id);

            if (journalError) {
                console.error('Error deleting journal entry:', journalError);
                // نستمر في حذف السند حتى لو فشل حذف القيد
            }
        }

        // 3. حذف سطور السند (receipt_lines)
        await supabaseAdmin
            .from('receipt_lines')
            .delete()
            .eq('receipt_id', id);

        // 4. حذف السند نفسه
        const { error: deleteError } = await supabaseAdmin
            .from('receipts')
            .delete()
            .eq('id', id);

        if (deleteError) {
            throw new Error('فشل حذف سند القبض: ' + deleteError.message);
        }

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
        // 1. Get existing receipt
        const { data: existingReceipt, error: fetchError } = await supabaseAdmin
            .from('receipts')
            .select('journal_entry_id')
            .eq('id', id)
            .single();

        if (fetchError || !existingReceipt) {
            throw new Error('لم يتم العثور على السند');
        }

        // 2. Delete old journal entry
        if (existingReceipt.journal_entry_id) {
            await supabaseAdmin
                .from('journal_entries')
                .delete()
                .eq('id', existingReceipt.journal_entry_id);
        }

        // 3. Create new journal entry
        const journalEntry = await createJournalEntry({
            date: new Date(data.date).toISOString(),
            description: data.description,
            lines: [
                {
                    accountId: data.receiveAccountId,
                    debit: data.amount,
                    credit: 0,
                    description: data.description
                },
                {
                    accountId: data.receiveAccountId,
                    debit: 0,
                    credit: data.amount,
                    description: data.description
                }
            ]
        });

        if (!journalEntry.success || !journalEntry.entry) {
            throw new Error('فشل إنشاء القيد اليومي');
        }

        // 4. Add journal lines
        await supabaseAdmin.from('journal_lines').insert([
            {
                journal_entry_id: journalEntry.entry.id,
                account_id: data.receiveAccountId,
                debit: data.amount,
                credit: 0,
                description: data.description
            },
            {
                journal_entry_id: journalEntry.entry.id,
                account_id: data.receiveAccountId,
                debit: 0,
                credit: data.amount,
                description: data.description
            }
        ]);

        // 5. Update receipt
        const { error: updateError } = await supabaseAdmin
            .from('receipts')
            .update({
                receipt_date: data.date,
                customer_id: data.relatedUserId || null,
                total_amount: data.amount,
                bank_account_id: data.receiveAccountId,
                main_description: data.description,
                journal_entry_id: journalEntry.entry.id,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (updateError) {
            throw new Error('فشل تحديث السند');
        }

        revalidatePath('/accounting/receipts');
        revalidatePath('/accounting/dashboard');
        revalidatePath('/accounting/cash-bank');

        return { success: true };
    } catch (e: any) {
        console.error('Update Receipt Error:', e);
        return { success: false, error: e.message };
    }
}
