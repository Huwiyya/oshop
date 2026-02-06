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

export async function getPaymentById(id: string) {
    try {
        const { data, error } = await supabaseAdmin
            .from('payments')
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
            date: data.payment_date,
            reference: data.payment_number,
            payee: data.supplier_id ? `مورد ${data.supplier_id}` : '-',
            relatedSupplierId: data.supplier_id,
            paymentAccountId: data.bank_account_id,
            paymentAccountName: data.bank_account?.name_ar || data.bank_account?.name_en || 'غير محدد',
            description: data.main_description,
            amount: data.total_amount,
            currency: (data.bank_account?.currency || 'LYD') as 'LYD' | 'USD',
            lineItems: []
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
        payee: d.supplier_id ? `مورد ${d.supplier_id}` : '-', // يمكن تحسين هذا لاحقاً بجلب اسم المورد
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
        // 1. جلب السند للحصول على معرف القيد اليومي
        const { data: payment, error: fetchError } = await supabaseAdmin
            .from('payments')
            .select('journal_entry_id')
            .eq('id', id)
            .single();

        if (fetchError || !payment) {
            throw new Error('لم يتم العثور على سند الدفع');
        }

        // 2. حذف القيد اليومي المرتبط أولاً (بسبب foreign key)
        if (payment.journal_entry_id) {
            const { error: journalError } = await supabaseAdmin
                .from('journal_entries')
                .delete()
                .eq('id', payment.journal_entry_id);

            if (journalError) {
                console.error('Error deleting journal entry:', journalError);
                // نستمر في حذف السند حتى لو فشل حذف القيد
            }
        }

        // 3. حذف سطور السند (payment_lines)
        await supabaseAdmin
            .from('payment_lines')
            .delete()
            .eq('payment_id', id);

        // 4. حذف السند نفسه
        const { error: deleteError } = await supabaseAdmin
            .from('payments')
            .delete()
            .eq('id', id);

        if (deleteError) {
            throw new Error('فشل حذف سند الدفع: ' + deleteError.message);
        }

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
        // 1. Get existing payment
        const { data: existingPayment, error: fetchError } = await supabaseAdmin
            .from('payments')
            .select('journal_entry_id')
            .eq('id', id)
            .single();

        if (fetchError || !existingPayment) {
            throw new Error('لم يتم العثور على السند');
        }

        // 2. Delete old journal entry
        if (existingPayment.journal_entry_id) {
            await supabaseAdmin
                .from('journal_entries')
                .delete()
                .eq('id', existingPayment.journal_entry_id);
        }

        // 3. Create new journal entry
        const journalEntry = await createJournalEntry({
            entry_date: new Date(data.date).toISOString(),
            reference: `PAY-UPDATE-${id.slice(0, 8)}`,
            description: data.description,
            total_debit: data.amount,
            total_credit: data.amount,
            created_by: 'system'
        });

        if (!journalEntry.success || !journalEntry.entry) {
            throw new Error('فشل إنشاء القيد اليومي');
        }

        // 4. Add journal lines
        await supabaseAdmin.from('journal_lines').insert([
            {
                journal_entry_id: journalEntry.entry.id,
                account_id: data.paymentAccountId,
                debit: data.amount,
                credit: 0,
                description: data.description
            },
            {
                journal_entry_id: journalEntry.entry.id,
                account_id: data.paymentAccountId,
                debit: 0,
                credit: data.amount,
                description: data.description
            }
        ]);

        // 5. Update payment
        const { error: updateError } = await supabaseAdmin
            .from('payments')
            .update({
                payment_date: data.date,
                supplier_id: data.relatedSupplierId || null,
                total_amount: data.amount,
                bank_account_id: data.paymentAccountId,
                main_description: data.description,
                journal_entry_id: journalEntry.entry.id,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (updateError) {
            throw new Error('فشل تحديث السند');
        }

        revalidatePath('/accounting/payments');
        revalidatePath('/accounting/dashboard');
        revalidatePath('/accounting/cash-bank');

        return { success: true };
    } catch (e: any) {
        console.error('Update Payment Error:', e);
        return { success: false, error: e.message };
    }
}
