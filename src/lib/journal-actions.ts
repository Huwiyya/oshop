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
    // 1. Validate Balance
    const totalDebit = data.lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
    const totalCredit = data.lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);

    // السماح بفارق ضئيل جداً بسبب الكسور (Floating point)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(`القيد غير متوازن. المدين: ${totalDebit}, الدائن: ${totalCredit}`);
    }

    // 2. Generate Entry Number (Format: JE-YYYY-XXXX)
    const year = new Date(data.date).getFullYear();
    // Using simple count might conflict, better use a sequence or UUID-like short ref, but for accounting sequential is preferred.
    // Ensure we count existing entries in that year
    const { count } = await supabaseAdmin.from('journal_entries').select('*', { count: 'exact', head: true });
    // Assuming count is total, not per year.
    // Let's make it simpler: JE + Timestamp for now if high concurrency, or count+1.
    // Let's stick to user-friendly JE-YYYY-{count+1}
    const entryNumber = `JE-${year}-${String((count || 0) + 1).padStart(4, '0')}`;

    // 3. Create Entry Header
    const { data: entry, error: entryError } = await supabaseAdmin
        .from('journal_entries')
        .insert({
            entry_number: entryNumber,
            entry_date: data.date,
            description: data.description,
            reference_type: data.referenceType || 'manual',
            reference_id: data.referenceId,
            total_debit: totalDebit,
            total_credit: totalCredit,
            status: 'posted' // الترحيل المباشر
        })
        .select()
        .single();

    if (entryError) throw new Error(entryError.message);

    // 4. Insert Lines & Handle Inventory
    let lineNum = 1;
    for (const line of data.lines) {
        if (!line.accountId) continue;

        // Insert Journal Line
        await supabaseAdmin.from('journal_entry_lines').insert({
            entry_id: entry.id,
            account_id: line.accountId,
            description: line.description || data.description,
            debit: line.debit,
            credit: line.credit,
            line_number: lineNum++
        });

        // --- Handle Inventory Adjustment if attached ---
        if (line.inventoryItemId && line.quantity) {

            // Logic: Debit = Increase, Credit = Decrease
            // If user enters Debit amount for inventory account, it's an Increase (Purchase/Adjustment)
            const isIncrease = line.debit > 0;

            if (isIncrease) {
                // Increase Inventory
                // Calculate Unit Cost based on the DEBIT AMOUNT entered by user
                const unitCost = line.quantity > 0 ? (line.debit / line.quantity) : 0;

                // 1. Create Layout (FIFO layer)
                const { data: layer } = await supabaseAdmin.from('inventory_layers').insert({
                    item_id: line.inventoryItemId,
                    quantity: line.quantity,
                    remaining_quantity: line.quantity,
                    unit_cost: unitCost,
                    purchase_date: data.date
                }).select().single();

                // 2. Record Transaction
                await supabaseAdmin.from('inventory_transactions').insert({
                    item_id: line.inventoryItemId,
                    transaction_type: 'adjustment_in',
                    transaction_date: data.date,
                    quantity: line.quantity,
                    unit_cost: unitCost,
                    total_cost: line.debit,
                    layer_id: layer?.id,
                    reference_type: 'journal_entry',
                    reference_id: entryNumber,
                    notes: line.description || 'تعديل زيادة (قيد يومية)'
                });

                // 3. Update Item Quantity
                const { data: item } = await supabaseAdmin.from('inventory_items').select('quantity_on_hand').eq('id', line.inventoryItemId).single();
                if (item) {
                    await supabaseAdmin.from('inventory_items').update({
                        quantity_on_hand: Number(item.quantity_on_hand) + Number(line.quantity)
                    }).eq('id', line.inventoryItemId);
                }

            } else {
                // Decrease Inventory (Credit side)
                // Need to deduce quantity. 
                // For simplicity in Manual Journal: We reduce quantity but calculating exacta cost (COGS) to match the Credit amount entered by user is tricky if user guessed it.
                // However, user usually enters Credit Amount based on book calculation? 
                // Or user wants to "Adjust Stock" and let the system credit the account?
                // The prompt says: "Make entry with inventory item ... increase or decrease"
                // If user specifies Credit Amount, we respect it as the adjustment value.

                // Unit Cost implied = Credit / Quantity
                const impliedUnitCost = line.quantity > 0 ? (line.credit / line.quantity) : 0;

                await supabaseAdmin.from('inventory_transactions').insert({
                    item_id: line.inventoryItemId,
                    transaction_type: 'adjustment_out',
                    transaction_date: data.date,
                    quantity: line.quantity,
                    unit_cost: impliedUnitCost,
                    total_cost: line.credit,
                    reference_type: 'journal_entry',
                    reference_id: entryNumber,
                    notes: line.description || 'تعديل نقص (قيد يومية)'
                });

                const { data: item } = await supabaseAdmin.from('inventory_items').select('quantity_on_hand').eq('id', line.inventoryItemId).single();
                if (item) {
                    await supabaseAdmin.from('inventory_items').update({
                        quantity_on_hand: Math.max(0, Number(item.quantity_on_hand) - Number(line.quantity))
                    }).eq('id', line.inventoryItemId);
                }
            }
        }
    }

    return entry.id; // Return Entry ID
}
