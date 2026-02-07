'use server';

import { supabaseAdmin } from './supabase-admin';
import { createJournalEntry, type JournalEntryLine } from './journal-actions';
import { createReceipt } from './receipt-actions';
import { createSalesInvoiceAtomic, updateSalesInvoice as updateSalesInvoiceAtomic, deleteDocumentAtomic } from './atomic-actions';

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

export async function getSalesInvoices(filters?: { query?: string; startDate?: string; endDate?: string }) {
    let query = supabaseAdmin
        .from('sales_invoices')
        .select(`
            *,
            customer:accounts!customer_account_id(name_ar, name_en)
        `)
        .order('invoice_date', { ascending: false });

    if (filters?.startDate) query = query.gte('invoice_date', filters.startDate);
    if (filters?.endDate) query = query.lte('invoice_date', filters.endDate);
    if (filters?.query) {
        query = query.or(`invoice_number.ilike.%${filters.query}%,notes.ilike.%${filters.query}%`);
    }

    const { data, error } = await query.limit(50);

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
    // Prepare Data for RPC
    // RPC expects: invoice_data { customerId, date, currency, rate, paidAmount, paymentAccountId, notes }
    const invoiceData = {
        customerId: data.customerId,
        date: data.invoiceDate,
        currency: data.currency,
        rate: data.exchangeRate,
        paidAmount: data.paidAmount,
        paymentAccountId: data.paymentAccountId,
        notes: data.notes
    };

    // RPC expects: items [ { itemId, quantity, unitPrice, description, selectedLayerIds? } ]
    // Our data.items already matches closer, just ensuring fields.
    const items = data.items.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        description: item.description,
        selectedLayerIds: item.selectedLayerIds
    }));

    try {
        const result = await createSalesInvoiceAtomic(invoiceData, items);
        return result;
    } catch (error: any) {
        console.error("Create Sales Invoice Atomic Error:", error);
        throw new Error(error.message || 'فشل إنشاء الفاتورة');
    }
}

export async function deleteSalesInvoice(id: string) {
    try {
        // Use generic delete document RPC
        await deleteDocumentAtomic(id, 'sales');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateSalesInvoice(id: string, data: CreateSalesInvoiceData) {
    // Prepare Data for RPC
    const invoiceData = {
        customerId: data.customerId,
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
        selectedLayerIds: item.selectedLayerIds
    }));

    try {
        const result = await updateSalesInvoiceAtomic(id, invoiceData, items);
        return { success: true, ...result };
    } catch (error: any) {
        throw new Error(error.message || 'فشل تعديل الفاتورة');
    }
}
