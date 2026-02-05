'use server';

import { supabaseAdmin } from './supabase-admin';
import { supabase } from './supabase'; // For client-side if needed, but we stick to admin for consistent logic

// --- إدارة المخزون ---

export async function getInventoryItems() {
    const { data, error } = await supabaseAdmin
        .from('inventory_items')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching inventory items:', error);
        return [];
    }
    return data;
}

export async function getInventoryItemById(id: string) {
    const { data, error } = await supabaseAdmin
        .from('inventory_items')
        .select('*')
        .eq('id', id)
        .single();
    if (error) return null;
    return data;
}

export async function createInventoryItem(data: {
    item_code: string;
    name_ar: string;
    name_en?: string;
    category?: string; // e.g., 'shein_cards'
    description?: string;
}) {
    // Get Inventory Account (Assets -> Inventory)
    const { data: inventoryAcc } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('account_code', '1130') // كود المخزون الثابت
        .single();

    // Get COGS Account (Expenses -> COGS)
    const { data: cogsAcc } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('account_code', '5100') // كود تكلفة البضاعة المباعة
        .single();

    const { data: newItem, error } = await supabaseAdmin
        .from('inventory_items')
        .insert({
            ...data,
            inventory_account_id: inventoryAcc?.id, // Link to GL
            cogs_account_id: cogsAcc?.id,
            is_shein_card: data.category === 'cards',
            unit: data.category === 'cards' ? 'card' : 'piece'
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return newItem;
}

// جلب البطاقات (Layers) لصنف معين
export async function getItemLayers(itemId: string) {
    const { data, error } = await supabaseAdmin
        .from('inventory_layers')
        .select('*')
        .eq('item_id', itemId)
        .gt('remaining_quantity', 0) // فقط البطاقات التي بها رصيد
        .order('created_at', { ascending: true }); // FIFO - الأقدم أولاً للبيع

    if (error) {
        console.error('Error fetching layers:', error);
        return [];
    }
    return data;
}

// إضافة رصيد جديد (شراء بطاقات أو بضاعة)
export async function addInventoryStock(data: {
    itemId: string;
    quantity: number;
    unitCost: number;
    purchaseDate: string;
    cardNumber?: string; // لبطاقات شي ان
    notes?: string;
}) {
    // 1. Get Item info to know the GL account
    const { data: item } = await supabaseAdmin.from('inventory_items').select('*').eq('id', data.itemId).single();
    if (!item) throw new Error('Item not found');

    // 2. Insert Inventory Layer (FIFO Layer)
    const { data: layer, error: layerError } = await supabaseAdmin
        .from('inventory_layers')
        .insert({
            item_id: data.itemId,
            purchase_date: data.purchaseDate,
            quantity: data.quantity,
            remaining_quantity: data.quantity,
            unit_cost: data.unitCost,
            card_number: data.cardNumber
        })
        .select()
        .single();

    if (layerError) throw new Error(layerError.message);

    // 3. Create Inventory Transaction Record
    await supabaseAdmin.from('inventory_transactions').insert({
        item_id: data.itemId,
        transaction_type: 'purchase',
        transaction_date: data.purchaseDate,
        quantity: data.quantity,
        unit_cost: data.unitCost,
        total_cost: data.quantity * data.unitCost, // Total value added
        layer_id: layer.id,
        notes: data.notes || 'إضافة رصيد مخزني'
    });

    // 4. Update Item Total Quantity
    await supabaseAdmin
        .from('inventory_items')
        .update({
            quantity_on_hand: Number(item.quantity_on_hand) + Number(data.quantity),
            average_cost: data.unitCost // Simplified update, ideally weighted avg
        })
        .eq('id', data.itemId);

    // *Note*: A GL Journal Entry should also be created here (Db Inventory, Cr Cash/AP).
    // For now assuming this function is called part of a larger transaction or standalone adjustment.

    return layer;
}

// جلب حركة الصنف التفصيلية (كارت الصنف)
export async function getItemTransactions(itemId: string) {
    const { data, error } = await supabaseAdmin
        .from('inventory_transactions')
        .select(`
            *,
            layer:inventory_layers(card_number)
        `)
        .eq('item_id', itemId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching transactions:', error);
        return [];
    }
    return data;
}

export async function deleteInventoryItem(id: string) {
    // 1. Check if there are transactions
    const { count, error: txError } = await supabaseAdmin
        .from('inventory_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('item_id', id);

    if (txError) throw new Error(txError.message);

    if (count && count > 0) {
        throw new Error('لا يمكن حذف الصنف لوجود حركات مخزنية مسجلة عليه.');
    }

    // 1.5 Check if linked to Purchase Invoices
    const { count: invoiceCount, error: invError } = await supabaseAdmin
        .from('purchase_invoice_lines')
        .select('*', { count: 'exact', head: true })
        .eq('item_id', id);

    if (!invError && invoiceCount && invoiceCount > 0) {
        throw new Error('لا يمكن حذف الصنف لأنه مرتبط بفواتير شراء. يرجى حذف الفواتير أولاً.');
    }

    // 2. Delete remaining layers (cleanup orphan layers)
    const { error: layerDeleteError } = await supabaseAdmin
        .from('inventory_layers')
        .delete()
        .eq('item_id', id);

    if (layerDeleteError) throw new Error(layerDeleteError.message);

    // 3. Delete the item
    const { error } = await supabaseAdmin
        .from('inventory_items')
        .delete()
        .eq('id', id);

    if (error) throw new Error(error.message);
    return true;
}

export async function deleteInventoryTransaction(transactionId: string) {
    // 1. Get Transaction
    const { data: trx, error: fetchError } = await supabaseAdmin
        .from('inventory_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

    if (fetchError || !trx) throw new Error('Transaction not found');

    // 2. Logic based on type
    if (trx.transaction_type === 'purchase') {
        // Find associated layer
        if (trx.layer_id) {
            const { data: layer } = await supabaseAdmin.from('inventory_layers').select('*').eq('id', trx.layer_id).single();
            if (layer) {
                // Check if layer is untouched
                if (layer.remaining_quantity !== layer.quantity) {
                    throw new Error('لا يمكن حذف هذه الحركة لأن الرصيد (البطاقات) تم بيع جزء منه.');
                }
                // Delete Layer
                await supabaseAdmin.from('inventory_layers').delete().eq('id', trx.layer_id);
            }
        }

        // Decrease Item Quantity
        const { data: item } = await supabaseAdmin.from('inventory_items').select('quantity_on_hand').eq('id', trx.item_id).single();
        if (item) {
            await supabaseAdmin.from('inventory_items').update({
                quantity_on_hand: Math.max(0, item.quantity_on_hand - trx.quantity)
            }).eq('id', trx.item_id);
        }

    } else if (trx.transaction_type === 'sale') {
        throw new Error('حذف حركات البيع غير مدعوم حالياً للحفاظ على سلامة المخزون. يرجى عمل حركة "مرتجع مبيعات" بدلاً من ذلك.');
    }

    // 3. Delete Transaction
    const { error } = await supabaseAdmin.from('inventory_transactions').delete().eq('id', transactionId);
    if (error) throw new Error(error.message);

    return true;
}
