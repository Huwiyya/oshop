'use server';

import { supabaseAdmin } from './supabase-admin';
import { createJournalEntry, type JournalEntryLine } from './journal-actions';
import { createReceipt } from './receipt-actions';

// --- أنواع البيانات ---
export type SalesInvoiceItem = {
    itemId: string;
    quantity: number;
    unitPrice: number; // سعر البيع
    total: number;
    description: string;
    selectedLayerIds?: string[]; // معرفات البطاقات أو الطبقات المختارة للبيع (مهم جداً للبطاقات)
};

export type CreateSalesInvoiceData = {
    customerId: string;
    invoiceDate: string;
    items: SalesInvoiceItem[];
    currency: 'LYD' | 'USD';
    exchangeRate: number;
    paidAmount: number;
    paymentMethod?: 'cash' | 'bank';
    paymentAccountId?: string;
    notes?: string;
};

export async function getSalesInvoices() {
    const { data, error } = await supabaseAdmin
        .from('sales_invoices')
        .select(`
            *,
            customer:accounts!customer_account_id(name_ar, name_en)
        `)
        .order('invoice_date', { ascending: false });

    if (error) {
        console.error('Error fetching sales invoices:', error);
        return [];
    }
    return data;
}

// دالة لجلب البطاقات المتوفرة للبيع (للاختيار في الواجهة)
export async function getAvailableCardLayers(itemId: string) {
    const { data, error } = await supabaseAdmin
        .from('inventory_layers')
        .select('*')
        .eq('item_id', itemId)
        .gt('remaining_quantity', 0)
        .neq('card_number', null) // فقط التي لها أرقام
        .order('created_at', { ascending: true }); // الأقدم أولاً

    return data || [];
}

export async function createSalesInvoice(data: CreateSalesInvoiceData) {
    // 1. Generate Invoice Number
    const year = new Date().getFullYear();
    const { count } = await supabaseAdmin.from('sales_invoices').select('*', { count: 'exact', head: true });
    const invoiceNumber = `INV-${year}-${(count || 0) + 1000}`;

    let totalCost = 0;
    const subtotal = data.items.reduce((sum, item) => sum + item.total, 0);
    const remainingAmount = subtotal - data.paidAmount;
    const paymentStatus = data.paidAmount >= subtotal ? 'paid' : (data.paidAmount > 0 ? 'partial' : 'unpaid');

    // 2. Create Invoice Record
    const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from('sales_invoices')
        .insert({
            invoice_number: invoiceNumber,
            invoice_date: data.invoiceDate,
            customer_account_id: data.customerId,
            currency: data.currency,
            exchange_rate: data.exchangeRate,
            subtotal: subtotal,
            total_amount: subtotal,
            paid_amount: data.paidAmount,
            remaining_amount: remainingAmount,
            payment_status: paymentStatus,
            notes: data.notes
        })
        .select()
        .single();
    if (invoiceError) throw new Error(invoiceError.message);

    // 3. Process Items (Deduct Inventory & Record Cost)
    for (const item of data.items) {
        let itemCost = 0;
        let saleQuantity = item.quantity;
        let layersUsed: any[] = [];

        // A. Identify which layers to use (FIFO or Specific Selection)
        if (item.selectedLayerIds && item.selectedLayerIds.length > 0) {
            // Specific Selection (for Cards)
            const { data: layers } = await supabaseAdmin
                .from('inventory_layers')
                .select('*')
                .in('id', item.selectedLayerIds);

            if (layers) {
                // Deduce from these specific layers
                for (const layer of layers) {
                    // Update Layer
                    await supabaseAdmin
                        .from('inventory_layers')
                        .update({ remaining_quantity: 0 }) // Assuming full card usage
                        .eq('id', layer.id);

                    itemCost += layer.unit_cost * 1; // 1 card
                    totalCost += layer.unit_cost;

                    layersUsed.push({ id: layer.id, cost: layer.unit_cost });
                }
            }
        } else {
            // FIFO Logic (for bulk items)
            // Fetch available layers ordered by date
            const { data: layers } = await supabaseAdmin
                .from('inventory_layers')
                .select('*')
                .eq('item_id', item.itemId)
                .gt('remaining_quantity', 0)
                .order('created_at', { ascending: true }); // Oldest first

            if (!layers) throw new Error(`Unavailable stock for item ${item.itemId}`);

            let qtyToDeduce = saleQuantity;

            for (const layer of layers) {
                if (qtyToDeduce <= 0) break;

                const deduction = Math.min(qtyToDeduce, layer.remaining_quantity);
                const costChunk = deduction * layer.unit_cost;

                itemCost += costChunk;
                totalCost += costChunk;

                // Update Layer
                await supabaseAdmin
                    .from('inventory_layers')
                    .update({ remaining_quantity: layer.remaining_quantity - deduction })
                    .eq('id', layer.id);

                layersUsed.push({ id: layer.id, cost: layer.unit_cost, qty: deduction });
                qtyToDeduce -= deduction;
            }

            if (qtyToDeduce > 0) {
                throw new Error(`Insufficient stock for item ${item.itemId}. Short by ${qtyToDeduce}`);
            }
        }

        // B. Insert Invoice Line
        // We calculate unit_cost as weighted average for the line record
        const avgUnitCost = itemCost / item.quantity;

        // Record outgoing transaction (important for item history)
        await supabaseAdmin.from('inventory_transactions').insert({
            item_id: item.itemId,
            transaction_type: 'sale',
            transaction_date: data.invoiceDate,
            quantity: item.quantity,
            unit_cost: avgUnitCost,
            total_cost: itemCost,
            reference_type: 'sales_invoice',
            reference_id: invoiceNumber,
            notes: `فاتورة بيع #${invoiceNumber}`
        });

        // Update Item Stock Summary
        const { data: currentItem } = await supabaseAdmin.from('inventory_items').select('quantity_on_hand').eq('id', item.itemId).single();
        if (currentItem) {
            await supabaseAdmin.from('inventory_items')
                .update({ quantity_on_hand: currentItem.quantity_on_hand - item.quantity })
                .eq('id', item.itemId);
        }

        // Insert Line
        await supabaseAdmin.from('sales_invoice_lines').insert({
            invoice_id: invoice.id,
            item_id: item.itemId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            unit_cost: avgUnitCost, // Important!
            total: item.total
        });
    }

    // 4. Update Invoice with Total Cost (Profit calculation)
    await supabaseAdmin
        .from('sales_invoices')
        .update({ total_cost: totalCost })
        .eq('id', invoice.id);

    // 5. Create Journal Entries
    // Need Accounts: Sales Revenue (4xxxx), COGS (5xxxx), Inventory (1xxxx)
    const { data: defaultRevenueAcc } = await supabaseAdmin.from('accounts').select('id, name_ar').eq('account_code', '4100').single();
    const { data: cogsAcc } = await supabaseAdmin.from('accounts').select('id').eq('account_code', '5100').single();
    const { data: inventoryAcc } = await supabaseAdmin.from('accounts').select('id').eq('account_code', '1130').single();

    // Retrieve revenue account IDs for all items
    const itemIds = data.items.map(i => i.itemId);
    const { data: dbItems } = await supabaseAdmin
        .from('inventory_items')
        .select('id, revenue_account_id')
        .in('id', itemIds);

    const itemRevenueMap = new Map();
    dbItems?.forEach(item => {
        if (item.revenue_account_id) {
            itemRevenueMap.set(item.id, item.revenue_account_id);
        }
    });

    // Group Revenue by Account
    const revenueGrouping = new Map<string, number>();

    for (const item of data.items) {
        const customAccId = itemRevenueMap.get(item.itemId);
        const targetAccId = customAccId || defaultRevenueAcc?.id;

        if (targetAccId) {
            const current = revenueGrouping.get(targetAccId) || 0;
            revenueGrouping.set(targetAccId, current + item.total);
        }
    }

    // A. Revenue Entry
    // Dr. Receivable (Customer)
    //   Cr. Revenue A
    //   Cr. Revenue B ...
    if (revenueGrouping.size > 0) {
        const creditLines: JournalEntryLine[] = [];
        for (const [accId, amount] of Array.from(revenueGrouping.entries())) {
            creditLines.push({
                accountId: accId,
                description: `إيراد مبيعات - فاتورة #${invoiceNumber}`,
                debit: 0,
                credit: amount
            });
        }

        await createJournalEntry({
            date: data.invoiceDate,
            description: `إثبات مبيعات فاتورة #${invoiceNumber}`,
            referenceType: 'sales_invoice',
            referenceId: invoiceNumber,
            currency: data.currency,
            lines: [
                { accountId: data.customerId, description: `استحقاق عميل - فاتورة #${invoiceNumber}`, debit: subtotal, credit: 0 },
                ...creditLines
            ]
        });
    }

    // B. COGS Entry (Perpetual Inventory)
    // Dr. COGS
    //   Cr. Inventory
    if (cogsAcc && inventoryAcc && totalCost > 0) {
        await createJournalEntry({
            date: data.invoiceDate,
            description: `إثبات تكلفة البضاعة المباعة - فاتورة #${invoiceNumber}`,
            referenceType: 'sales_cogs',
            referenceId: invoiceNumber,
            lines: [
                { accountId: cogsAcc.id, description: `تكلفة مبيعات - فاتورة #${invoiceNumber}`, debit: totalCost, credit: 0 },
                { accountId: inventoryAcc.id, description: `صرف مخزون - فاتورة #${invoiceNumber}`, debit: 0, credit: totalCost }
            ]
        });
    }

    // C. Payment Entry (If paid) -> Create Formal Receipt
    if (data.paidAmount > 0 && data.paymentAccountId) {
        // Use the centralized createReceipt action to ensure "Receipts Register" is updated
        // Validating customerId as accountId for the Credit side (Reducing Customer Debt)

        await createReceipt({
            date: data.invoiceDate,
            receiveAccountId: data.paymentAccountId, // Debit: Cash/Bank
            receiveAccountName: '', // Optional/Fetched internally
            payer: `عميل فاتورة ${invoiceNumber}`,
            description: `سداد فاتورة بيع #${invoiceNumber}`,
            amount: data.paidAmount,
            currency: data.currency,
            lineItems: [
                {
                    accountId: data.customerId, // Credit: Customer (Receivable)
                    amount: data.paidAmount,
                    description: `سداد خصماً من مديونية الفاتورة #${invoiceNumber}`
                }
            ]
        });
    }

    return invoice;
}

export async function deleteSalesInvoice(id: string) {
    // 1. Get Invoice Details
    const { data: invoice } = await supabaseAdmin.from('sales_invoices').select('*, lines:sales_invoice_lines(*)').eq('id', id).single();
    if (!invoice) return { success: false, error: 'الفاتورة غير موجودة' };

    try {
        // 2. Reverse Inventory Impact (Simple Restoration)
        if (invoice.lines && invoice.lines.length > 0) {
            for (const line of invoice.lines) {
                const { data: item } = await supabaseAdmin.from('inventory_items').select('quantity_on_hand').eq('id', line.item_id).single();
                if (item) {
                    await supabaseAdmin.from('inventory_items')
                        .update({ quantity_on_hand: item.quantity_on_hand + line.quantity })
                        .eq('id', line.item_id);
                }
            }
        }

        // 3. Delete Inventory Transactions
        await supabaseAdmin.from('inventory_transactions').delete().eq('reference_id', invoice.invoice_number);

        // 4. Delete Journal Entries (entries linked to this invoice)
        // Note: We query by reference_id (Invoice Number)
        const { data: entries } = await supabaseAdmin.from('journal_entries').select('id').eq('reference_id', invoice.invoice_number);
        if (entries && entries.length > 0) {
            const entryIds = entries.map(e => e.id);
            await supabaseAdmin.from('journal_entry_lines').delete().in('journal_entry_id', entryIds);
            await supabaseAdmin.from('journal_entries').delete().in('id', entryIds);
        }

        // 5. Delete Invoice Lines & Invoice
        await supabaseAdmin.from('sales_invoice_lines').delete().eq('invoice_id', id);
        const { error } = await supabaseAdmin.from('sales_invoices').delete().eq('id', id);

        if (error) throw error;

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateSalesInvoice(id: string, data: CreateSalesInvoiceData) {
    // 1. Get Existing Invoice
    const { data: currentInvoice, error: fetchError } = await supabaseAdmin
        .from('sales_invoices')
        .select('*, lines:sales_invoice_lines(*)')
        .eq('id', id)
        .single();

    if (fetchError || !currentInvoice) throw new Error('الفاتورة غير موجودة');

    const invoiceNumber = currentInvoice.invoice_number;

    // 2. REVERT: Reverse Inventory & Clean up old data
    // A. Re-stock items (Simple restoration)
    if (currentInvoice.lines && currentInvoice.lines.length > 0) {
        for (const line of currentInvoice.lines) {
            const { data: item } = await supabaseAdmin.from('inventory_items').select('quantity_on_hand').eq('id', line.item_id).single();
            if (item) {
                await supabaseAdmin.from('inventory_items')
                    .update({ quantity_on_hand: item.quantity_on_hand + line.quantity })
                    .eq('id', line.item_id);
            }
            // Note: Restoring specific layers is complex without detailed tracking. 
            // We assume LIFO/FIFO isn't strictly reversed here, but stock count is restored.
        }
    }

    // B. Delete Old Data
    await supabaseAdmin.from('sales_invoice_lines').delete().eq('invoice_id', id);
    await supabaseAdmin.from('inventory_transactions').delete().eq('reference_id', invoiceNumber);

    // Delete linked Journal Entries
    const { data: oldEntries } = await supabaseAdmin.from('journal_entries').select('id').eq('reference_id', invoiceNumber);
    if (oldEntries && oldEntries.length > 0) {
        const ids = oldEntries.map(e => e.id);
        await supabaseAdmin.from('journal_entry_lines').delete().in('journal_entry_id', ids);
        await supabaseAdmin.from('journal_entries').delete().in('id', ids);
    }

    // 3. APPLY UPDATE: Update Head Record
    let totalCost = 0;
    const subtotal = data.items.reduce((sum, item) => sum + item.total, 0);
    const remainingAmount = subtotal - data.paidAmount;
    const paymentStatus = data.paidAmount >= subtotal ? 'paid' : (data.paidAmount > 0 ? 'partial' : 'unpaid');

    const { error: updateError } = await supabaseAdmin
        .from('sales_invoices')
        .update({
            invoice_date: data.invoiceDate,
            customer_account_id: data.customerId,
            currency: data.currency,
            exchange_rate: data.exchangeRate,
            subtotal: subtotal,
            total_amount: subtotal,
            paid_amount: data.paidAmount,
            remaining_amount: remainingAmount,
            payment_status: paymentStatus,
            notes: data.notes
        })
        .eq('id', id);

    if (updateError) throw new Error(updateError.message);

    // 4. RE-PROCESS Items (Same logic as Create)
    for (const item of data.items) {
        let itemCost = 0;
        let saleQuantity = item.quantity;

        // A. Layer Logic
        if (item.selectedLayerIds && item.selectedLayerIds.length > 0) {
            // Specific Selection
            const { data: layers } = await supabaseAdmin.from('inventory_layers').select('*').in('id', item.selectedLayerIds);
            if (layers) {
                for (const layer of layers) {
                    await supabaseAdmin.from('inventory_layers').update({ remaining_quantity: 0 }).eq('id', layer.id);
                    itemCost += layer.unit_cost * 1;
                    totalCost += layer.unit_cost;
                }
            }
        } else {
            // FIFO Logic
            const { data: layers } = await supabaseAdmin
                .from('inventory_layers')
                .select('*')
                .eq('item_id', item.itemId)
                .gt('remaining_quantity', 0)
                .order('created_at', { ascending: true });

            if (!layers) throw new Error(`Unavailable stock for item ${item.itemId}`);

            let qtyToDeduce = saleQuantity;
            for (const layer of layers) {
                if (qtyToDeduce <= 0) break;
                const deduction = Math.min(qtyToDeduce, layer.remaining_quantity);
                const costChunk = deduction * layer.unit_cost;
                itemCost += costChunk;
                totalCost += costChunk;

                await supabaseAdmin
                    .from('inventory_layers')
                    .update({ remaining_quantity: layer.remaining_quantity - deduction })
                    .eq('id', layer.id);

                qtyToDeduce -= deduction;
            }
            if (qtyToDeduce > 0) throw new Error(`Insufficient stock for item ${item.itemId}`);
        }

        const avgUnitCost = itemCost / item.quantity;

        // Record Transaction
        await supabaseAdmin.from('inventory_transactions').insert({
            item_id: item.itemId,
            transaction_type: 'sale',
            transaction_date: data.invoiceDate,
            quantity: item.quantity,
            unit_cost: avgUnitCost,
            total_cost: itemCost,
            reference_type: 'sales_invoice',
            reference_id: invoiceNumber,
            notes: `تعديل فاتورة بيع #${invoiceNumber}`
        });

        // Update Item Stock
        const { data: currentItem } = await supabaseAdmin.from('inventory_items').select('quantity_on_hand').eq('id', item.itemId).single();
        if (currentItem) {
            await supabaseAdmin.from('inventory_items')
                .update({ quantity_on_hand: currentItem.quantity_on_hand - item.quantity })
                .eq('id', item.itemId);
        }

        // Insert Line
        await supabaseAdmin.from('sales_invoice_lines').insert({
            invoice_id: id,
            item_id: item.itemId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            unit_cost: avgUnitCost,
            total: item.total
        });
    }

    // Update Total Cost
    await supabaseAdmin.from('sales_invoices').update({ total_cost: totalCost }).eq('id', id);

    // 5. RE-CREATE Journal Entries
    const { data: defaultRevenueAcc } = await supabaseAdmin.from('accounts').select('id, name_ar').eq('account_code', '4100').single();
    const { data: cogsAcc } = await supabaseAdmin.from('accounts').select('id').eq('account_code', '5100').single();
    const { data: inventoryAcc } = await supabaseAdmin.from('accounts').select('id').eq('account_code', '1130').single();

    // Group Revenue
    const itemIds = data.items.map(i => i.itemId);
    const { data: dbItems } = await supabaseAdmin.from('inventory_items').select('id, revenue_account_id').in('id', itemIds);
    const itemRevenueMap = new Map();
    dbItems?.forEach(item => { if (item.revenue_account_id) itemRevenueMap.set(item.id, item.revenue_account_id); });

    const revenueGrouping = new Map<string, number>();
    for (const item of data.items) {
        const customAccId = itemRevenueMap.get(item.itemId);
        const targetAccId = customAccId || defaultRevenueAcc?.id;
        if (targetAccId) {
            const current = revenueGrouping.get(targetAccId) || 0;
            revenueGrouping.set(targetAccId, current + item.total);
        }
    }

    // A. Revenue Entry
    if (revenueGrouping.size > 0) {
        const creditLines: JournalEntryLine[] = [];
        for (const [accId, amount] of Array.from(revenueGrouping.entries())) {
            creditLines.push({
                accountId: accId,
                description: `إيراد مبيعات - فاتورة #${invoiceNumber}`,
                debit: 0,
                credit: amount
            });
        }
        await createJournalEntry({
            date: data.invoiceDate,
            description: `إثبات مبيعات فاتورة (معدلة) #${invoiceNumber}`,
            referenceType: 'sales_invoice',
            referenceId: invoiceNumber,
            currency: data.currency,
            lines: [
                { accountId: data.customerId, description: `استحقاق عميل - فاتورة #${invoiceNumber}`, debit: subtotal, credit: 0 },
                ...creditLines
            ]
        });
    }

    // B. COGS Entry
    if (cogsAcc && inventoryAcc && totalCost > 0) {
        await createJournalEntry({
            date: data.invoiceDate,
            description: `إثبات تكلفة البضاعة المباعة - فاتورة (معدلة) #${invoiceNumber}`,
            referenceType: 'sales_cogs',
            referenceId: invoiceNumber,
            lines: [
                { accountId: cogsAcc.id, description: `تكلفة مبيعات - فاتورة #${invoiceNumber}`, debit: totalCost, credit: 0 },
                { accountId: inventoryAcc.id, description: `صرف مخزون - فاتورة #${invoiceNumber}`, debit: 0, credit: totalCost }
            ]
        });
    }

    // C. Payment Entry
    if (data.paidAmount > 0 && data.paymentAccountId) {
        await createJournalEntry({
            date: data.invoiceDate,
            description: `تحصيل نقدية - فاتورة (معدلة) #${invoiceNumber}`,
            referenceType: 'receipt',
            referenceId: invoiceNumber,
            currency: data.currency,
            lines: [
                { accountId: data.paymentAccountId, description: `تحصيل من عميل - فاتورة #${invoiceNumber}`, debit: data.paidAmount, credit: 0 },
                { accountId: data.customerId, description: `سداد عميل - فاتورة #${invoiceNumber}`, debit: 0, credit: data.paidAmount }
            ]
        });
    }

    return { success: true };
}
