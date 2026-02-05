'use server';

import { supabaseAdmin } from './supabase-admin';
import { createJournalEntry, type JournalEntryLine } from './journal-actions';

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
    const { data: revenueAcc } = await supabaseAdmin.from('accounts').select('id').eq('account_code', '4100').single();
    const { data: cogsAcc } = await supabaseAdmin.from('accounts').select('id').eq('account_code', '5100').single();
    const { data: inventoryAcc } = await supabaseAdmin.from('accounts').select('id').eq('account_code', '1130').single(); // Should match Purchase logic

    // A. Revenue Entry
    // Dr. Receivable (Customer)
    //   Cr. Revenue
    if (revenueAcc) {
        await createJournalEntry({
            date: data.invoiceDate,
            description: `إثبات مبيعات فاتورة #${invoiceNumber}`,
            referenceType: 'sales_invoice',
            referenceId: invoiceNumber,
            currency: data.currency,
            lines: [
                { accountId: data.customerId, description: `استحقاق عميل - فاتورة #${invoiceNumber}`, debit: subtotal, credit: 0 },
                { accountId: revenueAcc.id, description: `إيراد مبيعات - فاتورة #${invoiceNumber}`, debit: 0, credit: subtotal }
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

    // C. Payment Entry (If paid)
    if (data.paidAmount > 0 && data.paymentAccountId) {
        await createJournalEntry({
            date: data.invoiceDate,
            description: `تحصيل نقدية - فاتورة #${invoiceNumber}`,
            referenceType: 'receipt',
            referenceId: invoiceNumber,
            currency: data.currency, // If payment is same currency as invoice
            lines: [
                { accountId: data.paymentAccountId, description: `تحصيل من عميل - فاتورة #${invoiceNumber}`, debit: data.paidAmount, credit: 0 },
                { accountId: data.customerId, description: `سداد عميل - فاتورة #${invoiceNumber}`, debit: 0, credit: data.paidAmount }
            ]
        });
    }

    return invoice;
}
