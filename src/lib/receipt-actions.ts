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
        // الدائن: حساب الإيراد/العميل (Line Items)

        const journalLines = [
            // Debit Line (حساب القبض - مدين)
            {
                accountId: data.receiveAccountId,
                debit: data.amount,
                credit: 0,
                description: `سند قبض: ${data.description}`
            },
            // Credit Lines (حسابات الإيراد/العملاء - دائن)
            ...data.lineItems.map(item => ({
                accountId: item.accountId,
                credit: item.amount,
                debit: 0,
                description: item.description || data.description
            }))
        ];

        // استدعاء دالة إنشاء القيد
        const journalEntryId = await createJournalEntry({
            date: data.date,
            description: `سند قبض من: ${data.payer || 'غير محدد'} - ${data.description}`,
            referenceType: 'receipt',
            lines: journalLines
        });

        // 2. إنشاء سند القبض في جدول receipts الجديد
        // توليد رقم السند
        const { count } = await supabaseAdmin.from('receipts').select('*', { count: 'exact', head: true });
        const receiptNumber = `REC-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`;

        const { data: newReceipt, error: receiptError } = await supabaseAdmin.from('receipts').insert({
            receipt_number: receiptNumber,
            receipt_date: data.date,
            customer_id: data.relatedUserId || null,
            total_amount: data.amount,
            payment_method: 'cash',
            bank_account_id: data.receiveAccountId,
            main_description: data.description,
            journal_entry_id: journalEntryId,
            status: 'posted'
        }).select().single();

        if (receiptError) throw new Error('فشل إنشاء سند القبض: ' + receiptError.message);

        // 3. إدخال تفاصيل السند (Lines)
        if (data.lineItems.length > 0) {
            const receiptLines = data.lineItems.map((item, index) => ({
                receipt_id: newReceipt.id,
                account_id: item.accountId,
                amount: item.amount,
                description: item.description || '',
                line_number: index + 1
            }));

            const { error: linesError } = await supabaseAdmin.from('receipt_lines').insert(receiptLines);
            if (linesError) console.error('Warning: Failed to insert receipt lines details', linesError);
        }

        // 4. (Legacy Support) تحديث الأرصدة القديمة
        const { error: balanceError } = await supabaseAdmin.rpc('increment_balance', {
            row_id: data.receiveAccountId,
            amount: data.amount
        });

        // Fallback
        if (balanceError) {
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
