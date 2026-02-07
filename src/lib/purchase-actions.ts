'use server';

import { supabaseAdmin } from './supabase-admin';
import { addInventoryStock, deleteInventoryTransaction } from './inventory-actions';
import { createJournalEntry, type JournalEntryLine } from './journal-actions';
import { createPayment } from './payment-actions';

// --- أنواع البيانات ---
export type PurchaseInvoiceItem = {
    itemId: string;
    quantity: number;
    unitPrice: number; // Cost
    total: number;
    description: string;
    cardNumbers?: string[]; // لأصناف البطاقات، قائمة الأرقام
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

// --- الدوال ---

// ... types remain the same ...

import { createPurchaseInvoiceAtomic, updatePurchaseInvoice as updatePurchaseInvoiceAtomic, deleteDocumentAtomic } from './atomic-actions';

export async function getPurchaseInvoices(filters?: { query?: string; startDate?: string; endDate?: string }) {
    let query = supabaseAdmin
        .from('purchase_invoices')
        .select(`
            *,
            supplier:accounts!supplier_account_id(name_ar, name_en)
        `)
        .order('invoice_date', { ascending: false });

    if (filters?.startDate) query = query.gte('invoice_date', filters.startDate);
    if (filters?.endDate) query = query.lte('invoice_date', filters.endDate);
    if (filters?.query) {
        query = query.or(`invoice_number.ilike.%${filters.query}%,notes.ilike.%${filters.query}%`);
    }

    const { data, error } = await query.limit(50);

    if (error) {
        console.error('Error fetching invoices:', error);
        return [];
    }
    return data;
}

export async function createPurchaseInvoice(data: CreateInvoiceData) {
    // Prepare Data for RPC
    const invoiceData = {
        supplierId: data.supplierId,
        date: data.invoiceDate,
        currency: data.currency,
        rate: data.exchangeRate,
        paidAmount: data.paidAmount,
        paymentAccountId: data.paymentAccountId,
        notes: data.notes
    };

    const items = data.items.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        description: item.description,
        cardNumbers: item.cardNumbers
    }));

    try {
        const result = await createPurchaseInvoiceAtomic(invoiceData, items);
        return result;
    } catch (error: any) {
        console.error("Create Purchase Invoice Atomic Error:", error);
        throw new Error(error.message || 'فشل إنشاء الفاتورة');
    }
}

export async function deletePurchaseInvoice(id: string) {
    try {
        await deleteDocumentAtomic(id, 'purchase');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updatePurchaseInvoice(invoiceId: string, data: CreateInvoiceData) {
    // Prepare Data for RPC
    const invoiceData = {
        supplierId: data.supplierId,
        date: data.invoiceDate,
        currency: data.currency,
        rate: data.exchangeRate,
        paidAmount: data.paidAmount,
        paymentAccountId: data.paymentAccountId,
        notes: data.notes
    };

    const items = data.items.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        description: item.description,
        cardNumbers: item.cardNumbers
    }));

    try {
        const result = await updatePurchaseInvoiceAtomic(invoiceId, invoiceData, items);
        return { success: true, ...result };
    } catch (error: any) {
        throw new Error(error.message || 'فشل تعديل الفاتورة');
    }
}
