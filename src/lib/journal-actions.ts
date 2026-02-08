'use server';

import { supabaseAdmin } from './supabase-admin';

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

export async function getJournalEntries(filters?: { query?: string; startDate?: string; endDate?: string }) {
    let query = supabaseAdmin
        .from('journal_entries')
        .select('*')
        .eq('is_system_hidden', false)
        .order('entry_date', { ascending: false });

    if (filters?.startDate) query = query.gte('entry_date', filters.startDate);
    if (filters?.endDate) query = query.lte('entry_date', filters.endDate);
    if (filters?.query) {
        query = query.or(`description.ilike.%${filters.query}%,entry_number.ilike.%${filters.query}%`);
    }

    const { data, error } = await query.limit(50);

    if (error) {
        console.error('Error fetching journal entries:', error);
        return [];
    }
    return data;
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
    // 1. Call the Atomic RPC function (Handles Balancing & Journal Creation)
    const { data: entryId, error } = await supabaseAdmin.rpc('create_journal_entry_rpc', {
        p_entry_date: data.date,
        p_description: data.description,
        p_reference_type: data.referenceType || 'manual',
        p_reference_id: data.referenceId ?? null,
        p_lines: data.lines
    });

    if (error) {
        console.error('RPC Error:', error);
        throw new Error('فشل إنشاء القيد: ' + error.message);
    }

    // --- 2. Handle Inventory Logic (Post-RPC) ---
    // Note: Ideally this should be inside the RPC for full atomicity.
    try {
        for (const line of data.lines) {
            if (line.inventoryItemId && line.quantity) {
                const isIncrease = line.debit > 0;
                const unitCost = line.quantity > 0 ? (line.debit / line.quantity) : 0;

                if (isIncrease) {
                    // 1. Create Layout (FIFO layer)
                    const { data: layer, error: layerError } = await supabaseAdmin.from('inventory_layers').insert({
                        item_id: line.inventoryItemId,
                        quantity: line.quantity,
                        remaining_quantity: line.quantity,
                        unit_cost: unitCost,
                        purchase_invoice_id: null,
                        created_at: data.date
                    }).select().single();

                    if (layerError) console.error('Error creating inventory layer:', layerError);

                    // 2. Transaction
                    await supabaseAdmin.from('inventory_transactions').insert({
                        item_id: line.inventoryItemId,
                        transaction_type: 'journal_entry',
                        transaction_date: data.date,
                        quantity: line.quantity,
                        unit_cost: unitCost,
                        total_cost: line.debit,
                        journal_entry_id: entryId,
                        layer_id: layer?.id,
                        description: data.description
                    });
                } else {
                    // Decrease Inventory
                    await supabaseAdmin.from('inventory_transactions').insert({
                        item_id: line.inventoryItemId,
                        transaction_type: 'journal_entry',
                        transaction_date: data.date,
                        quantity: -line.quantity, // Negative for decrease
                        unit_cost: 0,
                        total_cost: line.credit,
                        journal_entry_id: entryId,
                        description: data.description
                    });
                    // Note: We are not updating inventory_items quantity here because we rely on a trigger or periodic calculation in this system? 
                    // Actually, looking at the old code, it WAS updating inventory_items.

                    // 3. Update Item Quantity (Simple approach for now)
                    const { data: item } = await supabaseAdmin.from('inventory_items').select('quantity_on_hand').eq('id', line.inventoryItemId).single();
                    if (item) {
                        const currentQty = Number(item.quantity_on_hand) || 0;
                        const change = isIncrease ? line.quantity : -line.quantity;
                        await supabaseAdmin.from('inventory_items').update({
                            quantity_on_hand: currentQty + change
                        }).eq('id', line.inventoryItemId);
                    }
                }
            }
        }
    } catch (invError) {
        console.error('Inventory Processing Error:', invError);
    }

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

    return { success: true, entryId };
}
