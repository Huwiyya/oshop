'use server';

import { supabaseAdmin } from './supabase-admin';
import { revalidatePath } from 'next/cache';

/**
 * Format (Reset) all accounting data while preserving:
 * - Chart of accounts
 * - Inventory items (quantities will be reset)
 * - Customers and suppliers
 * - Employees
 */
export async function formatAccountingData() {
    try {
        // 1. Delete all journal entries and their lines
        const { error: journalLinesError } = await supabaseAdmin
            .from('journal_entry_lines')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (journalLinesError) throw new Error(`خطأ في حذف سطور القيود: ${journalLinesError.message}`);

        const { error: journalEntriesError } = await supabaseAdmin
            .from('journal_entries')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (journalEntriesError) throw new Error(`خطأ في حذف القيود: ${journalEntriesError.message}`);

        // 2. Delete all sales invoices and their lines
        const { error: salesLinesError } = await supabaseAdmin
            .from('sales_invoice_lines')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (salesLinesError) throw new Error(`خطأ في حذف سطور فواتير البيع: ${salesLinesError.message}`);

        const { error: salesInvoicesError } = await supabaseAdmin
            .from('sales_invoices')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (salesInvoicesError) throw new Error(`خطأ في حذف فواتير البيع: ${salesInvoicesError.message}`);

        // 3. Delete all purchase invoices and their lines
        const { error: purchaseLinesError } = await supabaseAdmin
            .from('purchase_invoice_lines')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (purchaseLinesError) throw new Error(`خطأ في حذف سطور فواتير الشراء: ${purchaseLinesError.message}`);

        const { error: purchaseInvoicesError } = await supabaseAdmin
            .from('purchase_invoices')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (purchaseInvoicesError) throw new Error(`خطأ في حذف فواتير الشراء: ${purchaseInvoicesError.message}`);

        // 4. Delete all receipts
        const { error: receiptsError } = await supabaseAdmin
            .from('receipts')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (receiptsError) throw new Error(`خطأ في حذف سندات القبض: ${receiptsError.message}`);

        // 5. Delete all payments
        const { error: paymentsError } = await supabaseAdmin
            .from('payments')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (paymentsError) throw new Error(`خطأ في حذف سندات الصرف: ${paymentsError.message}`);

        // 6. Delete all inventory transactions and layers
        const { error: inventoryTransError } = await supabaseAdmin
            .from('inventory_transactions')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (inventoryTransError) throw new Error(`خطأ في حذف معاملات المخزون: ${inventoryTransError.message}`);

        const { error: inventoryLayersError } = await supabaseAdmin
            .from('inventory_layers')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (inventoryLayersError) throw new Error(`خطأ في حذف طبقات المخزون: ${inventoryLayersError.message}`);

        // 7. Reset inventory quantities to zero
        const { error: inventoryResetError } = await supabaseAdmin
            .from('inventory_items')
            .update({ quantity_on_hand: 0 })
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (inventoryResetError) throw new Error(`خطأ في تصفير كميات المخزون: ${inventoryResetError.message}`);

        // 8. Delete all payroll records
        const { error: payrollError } = await supabaseAdmin
            .from('payroll_records')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (payrollError) throw new Error(`خطأ في حذف سجلات الرواتب: ${payrollError.message}`);

        // 9. Delete all fixed assets and depreciation schedules
        const { error: depreciationError } = await supabaseAdmin
            .from('depreciation_schedule')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (depreciationError) throw new Error(`خطأ في حذف جداول الإهلاك: ${depreciationError.message}`);

        const { error: assetsError } = await supabaseAdmin
            .from('fixed_assets')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (assetsError) throw new Error(`خطأ في حذف الأصول الثابتة: ${assetsError.message}`);

        // 10. Reset account balances for cash/bank accounts
        const { error: balanceResetError } = await supabaseAdmin
            .from('accounts')
            .update({ current_balance: 0 })
            .in('account_type', ['نقدية', 'بنوك', 'Cash', 'Bank']);

        if (balanceResetError) throw new Error(`خطأ في تصفير أرصدة الحسابات: ${balanceResetError.message}`);

        // Revalidate all accounting pages
        revalidatePath('/accounting/dashboard');
        revalidatePath('/accounting/journal-entries');
        revalidatePath('/accounting/sales-invoices');
        revalidatePath('/accounting/purchase-invoices');
        revalidatePath('/accounting/receipts');
        revalidatePath('/accounting/payments');
        revalidatePath('/accounting/inventory');
        revalidatePath('/accounting/fixed-assets');
        revalidatePath('/accounting/cash-bank');

        return {
            success: true,
            message: 'تم تصفير جميع البيانات المحاسبية بنجاح'
        };

    } catch (error: any) {
        console.error('Error formatting accounting data:', error);
        return {
            success: false,
            error: error.message || 'حدث خطأ أثناء تصفير البيانات'
        };
    }
}
