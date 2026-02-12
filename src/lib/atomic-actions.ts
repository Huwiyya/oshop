'use server';

import { supabaseAdmin } from './supabase-admin';

// Wrapper for Atomic SQL RPCs

export async function createSalesInvoiceAtomic(data: any, items: any[]) {
    const { data: result, error } = await supabaseAdmin.rpc('create_sales_invoice_rpc', {
        invoice_data: data,
        items: items
    });

    if (error) throw new Error(error.message);
    return result;
}

export async function createPurchaseInvoiceAtomic(data: any, items: any[]) {
    const { data: result, error } = await supabaseAdmin.rpc('create_purchase_invoice_rpc', {
        p_supplier_id: data.supplierId,
        p_date: data.date,
        p_items: items,
        p_currency: data.currency,
        p_exchange_rate: data.rate,
        p_notes: data.notes,
        p_payment_method: 'credit', // Defaulting to credit/later, or pass from data if available
        p_payment_account_id: data.paymentAccountId,
        p_paid_amount: data.paidAmount
    });

    if (error) throw new Error(error.message);
    return result;
}

export async function voidSalesInvoice(invoiceNumber: string, reason: string) {
    const { data: result, error } = await supabaseAdmin.rpc('void_sales_invoice_rpc', {
        invoice_number_param: invoiceNumber,
        reason: reason
    });

    if (error) throw new Error(error.message);
    return result;
}

export async function voidPurchaseInvoice(invoiceNumber: string, reason: string) {
    const { data: result, error } = await supabaseAdmin.rpc('void_purchase_invoice_rpc', {
        invoice_number_param: invoiceNumber,
        reason: reason
    });


    if (error) throw new Error(error.message);
    return result;
}

export async function updateSalesInvoice(id: string, data: any, items: any[]) {
    const { data: result, error } = await supabaseAdmin.rpc('update_sales_invoice_rpc', {
        p_invoice_id: id,
        p_new_data: data,
        p_new_items: items
    });

    if (error) throw new Error(error.message);
    return result;
}

export async function updatePurchaseInvoice(id: string, data: any, items: any[]) {
    const { data: result, error } = await supabaseAdmin.rpc('update_purchase_invoice_rpc', {
        p_invoice_id: id,
        p_new_data: data,
        p_new_items: items
    });

    if (error) throw new Error(error.message);
    return result;
}

// Flexible Inventory Wrapper (Item to Item / Open Transfer)
export async function createFlexibleInventoryTransaction(data: {
    date: string;
    description: string;
    items: {
        itemId: string;
        quantity: number; // Negative for Out, Positive for In
        unitCost?: number;
        notes?: string;
    }[];
}) {
    const { data: res, error } = await supabaseAdmin.rpc('create_inventory_transaction_rpc', {
        p_date: data.date,
        p_ref_number: '',
        p_description: data.description,
        p_lines: data.items
    });
    if (error) throw new Error(error.message);
    return res;
}

// Treasury Wrappers
export async function createReceiptAtomic(header: any, lines: any[]) {
    const { data: res, error } = await supabaseAdmin.rpc('create_receipt_rpc', {
        p_header: header,
        p_lines: lines
    });
    if (error) throw new Error(error.message);
    return res;
}

export async function createPaymentAtomic(header: any, lines: any[]) {
    const { data: res, error } = await supabaseAdmin.rpc('create_payment_rpc', {
        p_header: header,
        p_lines: lines
    });
    if (error) throw new Error(error.message);
    return res;
}

export async function updateReceiptAtomic(id: string, header: any, lines: any[]) {
    const { data: res, error } = await supabaseAdmin.rpc('update_receipt_rpc', {
        p_id: id,
        p_header: header,
        p_lines: lines
    });
    if (error) throw new Error(error.message);
    return res;
}

export async function updatePaymentAtomic(id: string, header: any, lines: any[]) {
    const { data: res, error } = await supabaseAdmin.rpc('update_payment_rpc', {
        p_id: id,
        p_header: header,
        p_lines: lines
    });
    if (error) throw new Error(error.message);
    return res;
}

export async function deleteDocumentAtomic(id: string, type: 'sales' | 'purchase' | 'receipt' | 'payment') {
    const { data: res, error } = await supabaseAdmin.rpc('delete_document_rpc', {
        p_id: id,
        p_type: type
    });
    if (error) throw new Error(error.message);
    return res;
}
