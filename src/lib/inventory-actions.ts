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
    category?: string;
    description?: string;
    inventory_account_id?: string;
    sales_account_id?: string;
    cogs_account_id?: string;
}) {
    // Default Inventory Account (Assets -> Inventory)
    const { data: inventoryAcc } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('account_code', '1130')
        .single();

    // Default COGS Account (Expenses -> COGS)
    const { data: cogsAcc } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('account_code', '5100')
        .single();

    // Default Sales Account (Revenue -> Sales)
    const { data: salesAcc } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('account_code', '4100')
        .single();

    const { data: newItem, error } = await supabaseAdmin
        .from('inventory_items')
        .insert({
            item_code: data.item_code,
            name_ar: data.name_ar,
            name_en: data.name_en,
            category: data.category,
            description: data.description,
            inventory_account_id: data.inventory_account_id && data.inventory_account_id !== '' ? data.inventory_account_id : inventoryAcc?.id,
            cogs_account_id: data.cogs_account_id && data.cogs_account_id !== '' ? data.cogs_account_id : cogsAcc?.id,
            sales_account_id: data.sales_account_id && data.sales_account_id !== '' ? data.sales_account_id : salesAcc?.id,
            is_shein_card: data.category === 'cards',
            unit: data.category === 'cards' ? 'card' : 'piece'
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return newItem;
}

export async function updateInventoryItem(id: string, data: {
    item_code?: string;
    name_ar?: string;
    name_en?: string;
    category?: string;
    description?: string;
    inventory_account_id?: string;
    sales_account_id?: string;
    cogs_account_id?: string;
    is_active?: boolean;
}) {
    const { data: updatedItem, error } = await supabaseAdmin
        .from('inventory_items')
        .update({
            ...data,
            is_shein_card: data.category ? data.category === 'cards' : undefined,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return updatedItem;
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
    referenceId?: string; // e.g. Invoice Number PI-2026-1001
    referenceType?: string; // e.g. 'purchase_invoice'
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
        notes: data.notes || 'إضافة رصيد مخزني',
        reference_id: data.referenceId,
        reference_type: data.referenceType
    });

    // 4. Update Item Total Quantity & Weighted Average Cost
    const currentQty = Number(item.quantity_on_hand) || 0;
    // If average_cost is null or 0, use unitCost as the starting cost
    const currentAvgCost = Number(item.average_cost) || 0;

    // Calculate new Weighted Average
    // Formula: ((OldQty * OldAvg) + (NewQty * NewCost)) / (OldQty + NewQty)
    const totalOldValue = currentQty * currentAvgCost;
    const totalNewValue = Number(data.quantity) * Number(data.unitCost);
    const newTotalQty = currentQty + Number(data.quantity);

    const newAvgCost = newTotalQty > 0
        ? (totalOldValue + totalNewValue) / newTotalQty
        : data.unitCost; // If quantity becomes 0 (unlikely here as we add), keep last cost or new cost.

    await supabaseAdmin
        .from('inventory_items')
        .update({
            quantity_on_hand: newTotalQty,
            average_cost: newAvgCost
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
// --- تسوية المخزون (Inventory Adjustments) ---

export type AdjustmentType = 'in' | 'out' | 'damaged' | 'gift' | 'opening';

export async function createInventoryAdjustment(data: {
    itemId: string;
    quantity: number; // الموجب زيادة، السالب نقص
    type: AdjustmentType;
    unitCost?: number; // مطلوب في حالة الزيادة (in/opening)
    notes?: string;
    date?: string;
}) {
    // 1. Get Item info
    const { data: item } = await supabaseAdmin.from('inventory_items').select('*').eq('id', data.itemId).single();
    if (!item) throw new Error('الصنف غير موجود');

    const adjustmentDate = data.date || new Date().toISOString().split('T')[0];
    const isIncrease = data.quantity > 0;
    const absQty = Math.abs(data.quantity);

    // التحقق من التكلفة
    let unitCost = Number(data.unitCost);
    if (isIncrease && (unitCost === undefined || unitCost < 0)) {
        throw new Error('يجب تحديد تكلفة الوحدة عند إضافة رصيد.');
    }

    // في حالة النقص، التكلفة تحسب بناءً على FIFO (المتوسط المرجح حالياً للتبسيط، أو نجلب الطبقات)
    // هنا سنستخدم متوسط التكلفة الحالي للصنف للخروج
    if (!isIncrease) {
        unitCost = Number(item.average_cost) || 0;
    }

    const totalAmount = absQty * unitCost;

    // 2. Create Journal Entry
    // Determine Accounts
    const inventoryAccountId = item.inventory_account_id; // Debit (Increase) / Credit (Decrease)
    if (!inventoryAccountId) throw new Error('حساب المخزون غير مربوط بهذا الصنف.');

    let offsetAccountId: string | undefined;

    // تحديد الحساب المقابل بناءً على نوع التسوية
    // هذه الأكواد يجب أن تكون موجودة في دليل الحسابات
    // 5201: تسويات جردية (مصروف)
    // 5100: تكلفة بضاعة مباعة (COGS)
    // 3103: بضاعة أول المدة (رأس المال/حقوق ملكية) أو حساب وسيط

    const getAccount = async (code: string) => {
        const { data } = await supabaseAdmin.from('accounts').select('id').eq('account_code', code).single();
        return data?.id;
    };

    if (data.type === 'opening') {
        offsetAccountId = await getAccount('3100'); // رأس المال (أو حساب تسوية أرصدة افتتاحية)
    } else if (data.type === 'damaged') {
        offsetAccountId = await getAccount('5201'); // مصروف تالف/عجز مخزون
    } else {
        offsetAccountId = await getAccount('5200'); // مصروفات أخرى/تسويات
    }

    if (!offsetAccountId) {
        // Fallback: If accounts don't exist, try getting a generic expense account or throw
        const { data: exp } = await supabaseAdmin.from('accounts').select('id').eq('account_code', '5200').single();
        offsetAccountId = exp?.id;
        // if (!offsetAccountId) throw new Error('تعذر تحديد حساب المصروف المقابل للتسوية. تأكد من وجود حساب 5200 أو 5201.');
    }

    const journalLines = [];

    // تأكد من وجود حساب مقابل
    if (!offsetAccountId) {
        // إذا لم نجد الحساب، لن نقوم بإنشاء قيد محاسبي كامل ولكن سنحدث المخزون فقط (مع رسالة تحذير أو خطأ)
        // الأفضل منع العملية
        throw new Error('تعذر تحديد حساب المصروف المقابل للتسوية.');
    }

    if (isIncrease) {
        // من ح/ المخزون (Debit)
        journalLines.push({
            account_id: inventoryAccountId,
            debit: totalAmount,
            credit: 0,
            description: `تسوية زيادة مخزون: ${item.name_ar} - ${data.type}`
        });
        // إلى ح/ التسوية (Credit)
        journalLines.push({
            account_id: offsetAccountId,
            debit: 0,
            credit: totalAmount,
            description: `تسوية زيادة مخزون: ${item.name_ar}`
        });
    } else {
        // من ح/ التسوية (Debit)
        journalLines.push({
            account_id: offsetAccountId,
            debit: totalAmount,
            credit: 0,
            description: `تسوية عجز/صرف مخزون: ${item.name_ar} - ${data.type}`
        });
        // إلى ح/ المخزون (Credit)
        journalLines.push({
            account_id: inventoryAccountId,
            debit: 0,
            credit: totalAmount,
            description: `تسوية عجز/صرف مخزون: ${item.name_ar}`
        });
    }

    // Call RPC to create Journal Entry
    const { data: journalId, error: rpcError } = await supabaseAdmin.rpc('create_journal_entry_rpc', {
        entry_date: adjustmentDate,
        description: `تسوية مخزنية - ${data.type} - ${item.name_ar}`,
        reference_type: 'inventory_adjustment',
        reference_id: null, // Will be linked later if needed
        lines: journalLines
    });

    if (rpcError) throw new Error(`فشل إنشاء القيد المحاسبي: ${rpcError.message}`);

    // 3. Update Inventory (Layer + Transaction + Item Card)
    // Reuse logic or replicate

    // A. Insert Transaction Record
    await supabaseAdmin.from('inventory_transactions').insert({
        item_id: data.itemId,
        transaction_type: data.type === 'damaged' ? 'adjustment_out' : (isIncrease ? 'adjustment_in' : 'adjustment_out'),
        transaction_date: adjustmentDate,
        quantity: absQty,
        unit_cost: unitCost,
        total_cost: totalAmount,
        notes: data.notes || 'تسوية مخزنية',
        reference_type: 'journal_entry',
        reference_id: journalId
    });

    // B. Handle Layers (FIFO)
    if (isIncrease) {
        // Create new layer
        await supabaseAdmin.from('inventory_layers').insert({
            item_id: data.itemId,
            purchase_date: adjustmentDate,
            quantity: absQty,
            remaining_quantity: absQty,
            unit_cost: unitCost,
            created_at: new Date().toISOString()
        });
    } else {
        // Consume Layers (FIFO)
        let qtyToConsume = absQty;
        // Get available layers sorted by date
        const layers = await getItemLayers(data.itemId);

        // We need to iterate carefully
        // Note: getItemLayers returns layers with remaining_quantity > 0
        if (layers) {
            for (const layer of layers) {
                if (qtyToConsume <= 0) break;

                const available = Number(layer.remaining_quantity);
                if (available <= 0) continue;

                const take = Math.min(available, qtyToConsume);

                // Update layer
                await supabaseAdmin.from('inventory_layers').update({
                    remaining_quantity: available - take
                }).eq('id', layer.id);

                qtyToConsume -= take;
            }
        }

        if (qtyToConsume > 0) {
            console.warn(`Warning: Consumed more stock than available in layers for item ${data.itemId}. Negative stock possible.`);
        }
    }

    // C. Update Item Master (Weighted Average & Qty)
    const currentQty = Number(item.quantity_on_hand) || 0;
    const currentAvg = Number(item.average_cost) || 0;

    let newQty: number;
    let newAvg: number = currentAvg;

    if (isIncrease) {
        newQty = currentQty + absQty;
        // W.Avg Update
        const oldVal = currentQty * currentAvg;
        const newVal = absQty * unitCost;
        if (newQty > 0) {
            newAvg = (oldVal + newVal) / newQty;
        }
    } else {
        newQty = currentQty - absQty;
        // Average cost doesn't change on OUT
    }

    await supabaseAdmin.from('inventory_items').update({
        quantity_on_hand: newQty,
        average_cost: newAvg
    }).eq('id', data.itemId);

    return true;
}

export async function transferInventory(data: {
    sourceItemId: string;
    targetItemId: string;
    quantity: number;
    date: string;
    notes?: string;
}) {
    const { data: result, error } = await supabaseAdmin.rpc('transfer_inventory_item_rpc', {
        p_source_item_id: data.sourceItemId,
        p_target_item_id: data.targetItemId,
        p_quantity: data.quantity,
        p_date: data.date,
        p_notes: data.notes || 'تحويل مخزني'
    });

    if (error) throw new Error(error.message);
    return result;
}
