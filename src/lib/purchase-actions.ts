'use server';

import { createPurchaseInvoiceV2, deletePurchaseInvoiceV2, getPurchaseInvoicesV2 } from './invoices-v2-actions';
import { createPaymentV2 } from './treasury-v2-actions';
import { getAccountIdByName } from './accounting-v2-actions';
import { revalidatePath } from 'next/cache';

// =============================================================================
// LEGACY INTERFACES
// =============================================================================

export type PurchaseInvoiceItem = {
    itemId: string;
    quantity: number;
    unitPrice: number; // Cost
    total: number;
    description: string;
    cardNumbers?: string[]; // Legacy specific
};

export type CreateInvoiceData = {
    supplierId: string;
    invoiceDate: string;
    items: PurchaseInvoiceItem[];
    currency: 'LYD' | 'USD';
    exchangeRate: number;
    paidAmount: number; // المبلغ المدفوع (إن وجد)
    paymentMethod?: 'cash' | 'bank'; // إذا دفع
    paymentAccountId?: string; // الخزينة/البنك المدفوع منه
    notes?: string;
};

// =============================================================================
// MIGRATION ACTIONS
// =============================================================================

export async function getPurchaseInvoices(filters?: { query?: string; startDate?: string; endDate?: string }) {
    const result = await getPurchaseInvoicesV2(filters);

    if (!result.success || !result.data) {
        return [];
    }

    // Map V2 to Legacy Format
    return result.data.map(inv => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        invoice_date: inv.date,
        total_amount: inv.total_amount,
        paid_amount: 0, // TODO: Fetch linked payments if critical
        remaining_amount: inv.total_amount,
        status: inv.status,
        notes: inv.description,
        supplier: inv.supplier,
        supplier_id: inv.supplier_account_id
    }));
}

export async function createPurchaseInvoice(data: CreateInvoiceData) {
    try {
        console.log("Creating Purchase Invoice via V2 Backend...", data);

        // Dynamic Account Lookup
        let inventoryAccountId = await getAccountIdByName('Inventory');
        if (!inventoryAccountId) inventoryAccountId = await getAccountIdByName('Asset');
        if (!inventoryAccountId) inventoryAccountId = await getAccountIdByName('مخزون');

        if (!inventoryAccountId) {
            // Fallback for safety - User technically warned to update this, but we try best effort
            inventoryAccountId = '11111111-1111-1111-1111-111111111111'; // Placeholder
            console.warn('Inventory Account not found by name, using placeholder:', inventoryAccountId);
        }

        const input = {
            date: data.invoiceDate,
            supplier_account_id: data.supplierId,
            expense_account_id: inventoryAccountId, // Defines where the Debit goes (Inventory Asset)
            description: data.notes,
            items: data.items.map(item => ({
                product_id: item.itemId,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unitPrice
            }))
        };

        const result = await createPurchaseInvoiceV2(input);
        if (!result.success || !result.data) {
            throw new Error(result.error);
        }

        const invoiceId = result.data.id;

        // 2. Handle Payment (if paidAmount > 0)
        if (data.paidAmount > 0 && data.paymentAccountId) {
            await createPaymentV2({
                date: data.invoiceDate,
                supplier_account_id: data.supplierId, // Optional reference
                treasury_account_id: data.paymentAccountId,
                amount: data.paidAmount,
                description: `Bill Payment: ${result.data.invoice_number}`,
                lines: [{ // Debit the Supplier (AP)
                    account_id: data.supplierId,
                    amount: data.paidAmount,
                    description: `Payment for Bill ${result.data.invoice_number}`
                }]
            });
        }

        revalidatePath('/accounting/dashboard');
        revalidatePath('/accounting/purchase-invoices');
        revalidatePath('/accounting/inventory');

        return { success: true, id: invoiceId };

    } catch (error: any) {
        console.error("Create Purchase Invoice V2 Error:", error);
        throw new Error(error.message || 'فشل إنشاء الفاتورة');
    }
}

export async function deletePurchaseInvoice(id: string) {
    const result = await deletePurchaseInvoiceV2(id);

    if (!result.success) {
        return { success: false, error: result.error };
    }

    revalidatePath('/accounting/dashboard');
    revalidatePath('/accounting/purchase-invoices');
    revalidatePath('/accounting/inventory');

    return { success: true };
}

export async function updatePurchaseInvoice(invoiceId: string, data: CreateInvoiceData) {
    // Update logic: Delete + Recreate (Simplest for V2 migration phase)
    await deletePurchaseInvoiceV2(invoiceId);
    return await createPurchaseInvoice(data);
}

