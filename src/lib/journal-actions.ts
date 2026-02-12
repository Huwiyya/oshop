'use server';

import { supabaseAdmin } from './supabase-admin';
import { revalidatePath } from 'next/cache';

// --- أنواع البيانات ---
export type JournalEntryLine = {
    accountId: string;
    description?: string;
    debit: number;
    credit: number;
    // بيانات إضافية للمخزون (اختياري)
    inventoryItemId?: string;
    quantity?: number;
};

export async function getJournalEntries(filters?: { query?: string; startDate?: string; endDate?: string; page?: number; limit?: number }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
        .from('journal_entries')
        .select('*', { count: 'exact' })
        .eq('is_system_hidden', false)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false }); // Secondary sort for stability

    if (filters?.startDate) query = query.gte('entry_date', filters.startDate);
    if (filters?.endDate) query = query.lte('entry_date', filters.endDate);
    if (filters?.query) {
        query = query.or(`description.ilike.%${filters.query}%,entry_number.ilike.%${filters.query}%`);
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
        console.error('Error fetching journal entries:', error);
        return { data: [], totalCount: 0 };
    }
    return { data, totalCount: count || 0 };
}

export async function getJournalEntryDetails(id: string) {
    const { data: entry, error } = await supabaseAdmin
        .from('journal_entries')
        .select(`
            *,
            lines:journal_entry_lines(
                *,
                account:accounts(name_ar, account_code)
            )
        `)
        .eq('id', id)
        .single();

    if (error) return null;
    return entry;
}

export async function createJournalEntry(data: {
    date: string;
    description: string;
    referenceType?: string;
    referenceId?: string;
    lines: JournalEntryLine[];
    currency?: string;
}) {
    // 1. Call the Atomic RPC function (Handles Balancing, Journal Creation, AND Inventory)
    const { data: entryId, error } = await supabaseAdmin.rpc('create_complete_journal_rpc', {
        p_entry_date: data.date,
        p_description: data.description,
        p_reference_type: data.referenceType || 'manual',
        p_reference_id: data.referenceId ?? null,
        p_lines: data.lines // Now includes inventoryItemId and quantity
    });

    if (error) {
        console.error('RPC Error:', error);
        throw new Error('فشل إنشاء القيد: ' + error.message);
    }

    revalidatePath('/accounting/dashboard');
    revalidatePath('/accounting/journal');
    revalidatePath('/accounting/financial-reports');

    return { id: entryId };
}

/**
 * تعديل قيد يومية يدوي
 * ✅ يحذف الأسطر القديمة ويُنشئ أسطر جديدة
 * ⚠️ لا يدعم تعديل القيود المرتبطة بالمخزون حالياً (للحماية)
 */
export async function updateJournalEntry(entryId: string, data: {
    date: string;
    description: string;
    lines: JournalEntryLine[];
}) {
    // 1. التحقق من أن القيد موجود ويدوي
    const { data: existingEntry, error: fetchError } = await supabaseAdmin
        .from('journal_entries')
        .select('id, reference_type, entry_number')
        .eq('id', entryId)
        .single();

    if (fetchError || !existingEntry) {
        throw new Error('القيد غير موجود');
    }

    // 2. التحقق من التوازن
    const totalDebit = data.lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
    const totalCredit = data.lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(`القيد غير متوازن. المدين: ${totalDebit}, الدائن: ${totalCredit}`);
    }

    // 3. حذف الأسطر القديمة
    await supabaseAdmin
        .from('journal_entry_lines')
        .delete()
        .eq('entry_id', entryId);

    // 4. تحديث البيانات الرئيسية للقيد
    await supabaseAdmin
        .from('journal_entries')
        .update({
            entry_date: data.date,
            description: data.description,
            total_debit: totalDebit,
            total_credit: totalCredit,
            updated_at: new Date().toISOString()
        })
        .eq('id', entryId);

    // 5. إضافة الأسطر الجديدة
    let lineNum = 1;
    for (const line of data.lines) {
        if (!line.accountId) continue;

        await supabaseAdmin.from('journal_entry_lines').insert({
            entry_id: entryId,
            account_id: line.accountId,
            description: line.description || data.description,
            debit: line.debit,
            credit: line.credit,
            line_number: lineNum++
        });
    }

    revalidatePath('/accounting/dashboard');
    revalidatePath('/accounting/journal');
    revalidatePath('/accounting/financial-reports');

    return { success: true, entryId };
}
