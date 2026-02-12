'use server';

import { createSalesInvoiceV2, deleteSalesInvoiceV2, getSalesInvoicesV2 } from './invoices-v2-actions';
import { createReceiptV2 } from './treasury-v2-actions';
import { getAccountIdByName } from './accounting-v2-actions';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from './supabase-admin';

// =============================================================================
// LEGACY INTERFACES
// =============================================================================

export type SalesInvoiceItem = {
    itemId: string; // Product ID
    quantity: number;
    unitPrice: number;
    total: number;
    description: string;
    selectedLayerIds?: string[]; // Legacy specific, V2 FIFO handles this automatically usually, but we keep the field
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

// =============================================================================
// MIGRATION ACTIONS
// =============================================================================

export async function getSalesInvoices(filters?: { query?: string; startDate?: string; endDate?: string }) {
    const result = await getSalesInvoicesV2(filters);

    if (!result.success || !result.data) {
        return [];
    }

    // Map V2 to Legacy Format
    // Legacy UI expects: id, invoice_number, date, customer: { name_ar, name_en }, total_amount, paid_amount (calculated?), status
    // Note: V2 doesn't store 'paid_amount' on invoice directly, it's in receipts. 
    // For now, we might show full amount or 0 paid if we don't query receipts. 
    // To match legacy perfectly we'd need to sum receipts for this invoice.
    // For MVP Migration: Return total_amount.

    return result.data.map(inv => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        invoice_date: inv.date,
        total_amount: inv.total_amount,
        total_cost: inv.total_cost || 0, // Mapped for Profit calculation
        paid_amount: 0, // TODO: Fetch linked receipts if critical for UI list
        remaining_amount: inv.total_amount,
        status: inv.status,
        notes: inv.description,
        customer: inv.customer,
        customer_id: inv.customer_account_id
    }));
}

export async function getSalesInvoice(id: string) {
    const result = await getSalesInvoicesV2();
    // Optimization: We could use getSalesInvoiceV2(id) but for quick mapping let's use the list fetch or better, call the single one.
    // Let's call the single one we just added.
    const { getSalesInvoiceV2 } = await import('./invoices-v2-actions');
    const res = await getSalesInvoiceV2(id);

    if (!res.success || !res.data) return null;

    const inv = res.data;

    // Map to Legacy format for UI
    return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        invoice_date: inv.date,
        total_amount: inv.total_amount,
        paid_amount: 0,
        notes: inv.description,
        customer_id: inv.customer_account_id,
        customer: inv.customer,
        currency: 'LYD', // Default or fetch from customer/settings
        items: inv.lines?.map(line => ({
            itemId: line.product_id || '',
            description: line.product_name || line.description || '',
            quantity: line.quantity,
            unitPrice: line.unit_price,
            total: (line.quantity * line.unit_price)
        })) || []
    };
}

export async function getAvailableCardLayers(itemId: string) {
    // Legacy function for card selection. 
    // V2 uses `inventory_layers_v2`. We need to fetch specific card info if stored there.
    // If V2 config doesn't support specific card selection yet, we return empty or need to adapt.
    // Assuming V2 handles FIFO, manual selection might be deprecated or requires V2 Layer fetch.
    // Use direct query to V2 layers for now.

    const { data } = await supabaseAdmin
        .from('inventory_layers_v2')
        .select('*')
        .eq('product_id', itemId)
        .gt('remaining_quantity', 0)
        .order('date', { ascending: true });

    return data || [];
}

export async function createSalesInvoice(data: CreateSalesInvoiceData) {
    try {
        console.log("Creating Sales Invoice via V2 Backend...", data);

        // Dynamic Account Lookup
        let revenueAccountId = await getAccountIdByName('Sales');
        if (!revenueAccountId) revenueAccountId = await getAccountIdByName('Revenue');
        if (!revenueAccountId) revenueAccountId = await getAccountIdByName('إيرادات');

        if (!revenueAccountId) {
            // Fallback to a known ID or throw error. 
            // For migration safety, if not found, we might default to the first Revenue account or specific ID.
            revenueAccountId = '4bd930f3-9366-4191-881c-433b281bf785'; // Keep fallback for now
            console.warn('Revenue Account not found by name, using fallback:', revenueAccountId);
        }

        // 1. Create Invoice
        const input = {
            date: data.invoiceDate,
            customer_account_id: data.customerId,
            revenue_account_id: revenueAccountId,
            description: data.notes,
            items: await Promise.all(data.items.map(async item => {
                if (item.selectedLayerIds && item.selectedLayerIds.length > 0) {
                    // Fetch card numbers
                    const { data: layers } = await supabaseAdmin
                        .from('inventory_layers_v2')
                        .select('id, card_number')
                        .in('id', item.selectedLayerIds);

                    const layerMap = new Map(layers?.map(l => [l.id, l.card_number]) || []);

                    // Split into multiple lines
                    const lines = [];
                    // 1. Specific Card Lines
                    for (const layerId of item.selectedLayerIds) {
                        lines.push({
                            product_id: item.itemId,
                            product_name: item.description,
                            quantity: 1,
                            unit_price: item.unitPrice,
                            card_number: layerMap.get(layerId)
                        });
                    }
                    // 2. Remaining Quantity Line (if any)
                    if (item.quantity > item.selectedLayerIds.length) {
                        lines.push({
                            product_id: item.itemId,
                            product_name: item.description,
                            quantity: item.quantity - item.selectedLayerIds.length,
                            unit_price: item.unitPrice
                        });
                    }
                    return lines;
                }

                // Normal Item
                return [{
                    product_id: item.itemId,
                    product_name: item.description || 'Product',
                    quantity: item.quantity,
                    unit_price: item.unitPrice
                }];
            })).then(results => results.flat())
        };

        const result = await createSalesInvoiceV2(input);
        if (!result.success || !result.data) {
            throw new Error(result.error);
        }

        const invoiceId = result.data.id;

        // 2. Handle Payment (Receipt) if paidAmount > 0
        if (data.paidAmount > 0 && data.paymentAccountId) {
            await createReceiptV2({
                date: data.invoiceDate,
                customer_account_id: data.customerId,
                treasury_account_id: data.paymentAccountId,
                amount: data.paidAmount,
                description: `Invoice Payment: ${result.data.invoice_number}`,
                lines: [{ // Credit the Customer (AR)
                    account_id: data.customerId,
                    amount: data.paidAmount,
                    description: `Payment for Invoice ${result.data.invoice_number}`
                }]
            });
        }

        revalidatePath('/accounting/dashboard');
        revalidatePath('/accounting/sales-invoices');
        revalidatePath('/accounting/inventory');

        return { success: true, id: invoiceId };

    } catch (error: any) {
        console.error("Create Sales Invoice V2 Error:", error);
        throw new Error(error.message || 'فشل إنشاء الفاتورة');
    }
}

export async function deleteSalesInvoice(id: string) {
    // Delete Invoice V2
    const result = await deleteSalesInvoiceV2(id);
    // Note: Related receipts are NOT deleted automatically in standard accounting. They remain as "Unapplied Credits" or "Advances".
    // This is correct behavior.

    if (!result.success) {
        return { success: false, error: result.error };
    }

    revalidatePath('/accounting/dashboard');
    revalidatePath('/accounting/sales-invoices');
    revalidatePath('/accounting/inventory');

    return { success: true };
}

export async function updateSalesInvoice(id: string, data: CreateSalesInvoiceData) {
    // Update logic: Delete + Recreate (Simplest for V2 migration phase)
    await deleteSalesInvoiceV2(id);
    return await createSalesInvoice(data);
}

