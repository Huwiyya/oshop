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

import { createJournalEntry } from './journal-actions';

export async function createPayment(data: Omit<Payment, 'id' | 'reference'>) {
    try {
        // 1. إنشاء قيد اليومية (The Source of Truth)
        // المدين: حسابات المصروفات (Line Items)
        // الدائن: حساب الدفع (Cash/Bank)

        const journalLines = [
            // Credit Line (حساب الدفع - دائن)
            {
                accountId: data.paymentAccountId,
                credit: data.amount,
                debit: 0,
                description: `سند صرف: ${data.description}`
            },
            // Debit Lines (حسابات المصروف - مدين)
            ...data.lineItems.map(item => ({
                accountId: item.accountId,
                debit: item.amount,
                credit: 0,
                description: item.description || data.description
            }))
        ];

        // التحقق من توازن القيد يدوياً قبل الإرسال (اختياري، الدالة ستقوم به)
        // استدعاء دالة إنشاء القيد
        const journalEntryId = await createJournalEntry({
            date: data.date,
            description: `سند صرف للمستفيد: ${data.payee || 'غير محدد'} - ${data.description}`,
            referenceType: 'payment',
            lines: journalLines
        });

        // 2. إنشاء سند الصرف في جدول payments الجديد
        // توليد رقم السند
        const { count } = await supabaseAdmin.from('payments').select('*', { count: 'exact', head: true });
        const paymentNumber = `PAY-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`;

        const { data: newPayment, error: paymentError } = await supabaseAdmin.from('payments').insert({
            payment_number: paymentNumber,
            payment_date: data.date,
            total_amount: data.amount,
            payment_method: 'cash', // افتراضي، يمكن تحديثه لاحقاً
            bank_account_id: data.paymentAccountId,
            main_description: data.description,
            journal_entry_id: journalEntryId,
            status: 'posted'
        }).select().single();

        if (paymentError) throw new Error('فشل إنشاء سند الدفع: ' + paymentError.message);

        // 3. إدخال تفاصيل السند (Lines)
        if (data.lineItems.length > 0) {
            const paymentLines = data.lineItems.map((item, index) => ({
                payment_id: newPayment.id,
                account_id: item.accountId,
                amount: item.amount,
                description: item.description || '',
                line_number: index + 1
            }));

            const { error: linesError } = await supabaseAdmin.from('payment_lines').insert(paymentLines);
            if (linesError) console.error('Warning: Failed to insert payment lines details', linesError);
        }

        // 4. (Legacy Support) تحديث الأرصدة في الجداول القديمة إذا لزم الأمر
        // سنعتمد الآن على Journal Entries لحساب الأرصدة، ولكن إذا كانت هناك جداول قديمة تعتمد على القيمة المخزنة:
        // يمكننا ترك هذا الجزء أو تحديثه. للأمان، سنقوم بتحديث الرصيد الحالي للحساب في جدول accounts

        /* 
           تحديث رصيد الحساب المباشر (للعرض السريع)
           Credit Account -> Decrease Balance (Asset) or Increase (Liability)
           Assuming Payment Account is Asset (Cash/Bank) -> Decrease
        */
        const { error: balanceError } = await supabaseAdmin.rpc('decrement_balance', {
            row_id: data.paymentAccountId,
            amount: data.amount
        });

        // Fallback manual update
        if (balanceError) {
            const { data: acc } = await supabaseAdmin.from('accounts').select('current_balance').eq('id', data.paymentAccountId).single();
            if (acc) {
                await supabaseAdmin.from('accounts').update({
                    current_balance: Number(acc.current_balance) - Number(data.amount)
                }).eq('id', data.paymentAccountId);
            }
        }

        revalidatePath('/accounting/payments');
        revalidatePath('/accounting/dashboard');
        revalidatePath('/accounting/cash-bank');

        return { success: true, id: newPayment.id };

    } catch (e: any) {
        console.error('Create Payment Error:', e);
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

export async function updatePayment(id: string, data: Omit<Payment, 'id' | 'reference'>) {
    try {
        // 1. Get Old Transaction
        const { data: oldTrx } = await supabaseAdmin.from('accounting_transactions').select('*').eq('id', id).single();
        if (!oldTrx) throw new Error('Payment not found');

        // 2. Reverse Old Impact (Restore Balance of OLD account)
        // Manual Restore for Old Account
        const { data: oldAcc } = await supabaseAdmin.from('treasury_cards_v4').select('balance').eq('id', oldTrx.account_id).single();
        if (oldAcc) {
            await supabaseAdmin.from('treasury_cards_v4')
                .update({ balance: oldAcc.balance + oldTrx.amount })
                .eq('id', oldTrx.account_id);
        }

        // 3. Update Transaction
        const { error: updateError } = await supabaseAdmin.from('accounting_transactions').update({
            date: data.date,
            payee: data.payee,
            account_id: data.paymentAccountId, // New Account
            description: data.description,
            amount: data.amount, // New Amount
            currency: data.currency,
            line_items: data.lineItems
        }).eq('id', id);

        if (updateError) throw updateError;

        // 4. Apply New Impact (Deduct from NEW account)
        const { data: newAcc } = await supabaseAdmin.from('treasury_cards_v4').select('balance').eq('id', data.paymentAccountId).single();
        if (newAcc) {
            await supabaseAdmin.from('treasury_cards_v4')
                .update({ balance: newAcc.balance - data.amount })
                .eq('id', data.paymentAccountId);
        }

        revalidatePath('/accounting/payments');
        revalidatePath('/accounting/dashboard');
        revalidatePath('/accounting/cash-bank');
        return { success: true };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
