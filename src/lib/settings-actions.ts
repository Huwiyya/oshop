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
    const errors: string[] = [];
    let successCount = 0;

    try {
        // IMPORTANT: Delete in order - children before parents to avoid FK violations
        // Each deletion is wrapped in try-catch to skip non-existent tables

        // 0. Delete account_transactions (tracks all account movements)
        try {
            const { error } = await supabaseAdmin
                .from('account_transactions')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) throw error;
            successCount++;
        } catch (e: any) {
            if (!e.message?.includes('Could not find the table')) {
                errors.push(`معاملات الحسابات: ${e.message}`);
            }
        }

        // 1. Delete receipt lines first, then receipts (references journal_entries)
        try {
            await supabaseAdmin.from('receipt_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            const { error } = await supabaseAdmin
                .from('receipts')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) throw error;
            successCount++;
        } catch (e: any) {
            if (!e.message?.includes('Could not find the table')) {
                errors.push(`سندات القبض: ${e.message}`);
            }
        }

        // 2. Delete payment lines first, then payments (references journal_entries)
        try {
            await supabaseAdmin.from('payment_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            const { error } = await supabaseAdmin
                .from('payments')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) throw error;
            successCount++;
        } catch (e: any) {
            if (!e.message?.includes('Could not find the table')) {
                errors.push(`سندات الصرف: ${e.message}`);
            }
        }

        // 3. Delete all sales invoices and their lines
        try {
            await supabaseAdmin.from('sales_invoice_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabaseAdmin.from('sales_invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            successCount++;
        } catch (e: any) {
            if (!e.message?.includes('Could not find the table')) {
                errors.push(`فواتير البيع: ${e.message}`);
            }
        }

        // 4. Delete all purchase invoices and their lines
        try {
            await supabaseAdmin.from('purchase_invoice_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabaseAdmin.from('purchase_invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            successCount++;
        } catch (e: any) {
            if (!e.message?.includes('Could not find the table')) {
                errors.push(`فواتير الشراء: ${e.message}`);
            }
        }

        // 5. Delete all journal entry lines (child of journal_entries)
        try {
            const { error } = await supabaseAdmin
                .from('journal_entry_lines')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) throw error;
            successCount++;
        } catch (e: any) {
            if (!e.message?.includes('Could not find the table')) {
                errors.push(`سطور القيود: ${e.message}`);
            }
        }

        // 6. NOW delete all journal entries (parent table)
        try {
            const { error } = await supabaseAdmin
                .from('journal_entries')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) throw error;
            successCount++;
        } catch (e: any) {
            if (!e.message?.includes('Could not find the table')) {
                errors.push(`القيود اليومية: ${e.message}`);
            }
        }

        // 7. Delete all inventory transactions and layers
        try {
            await supabaseAdmin.from('inventory_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabaseAdmin.from('inventory_layers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            successCount++;
        } catch (e: any) {
            if (!e.message?.includes('Could not find the table')) {
                errors.push(`المخزون: ${e.message}`);
            }
        }

        // 8. Reset inventory quantities to zero
        try {
            const { error } = await supabaseAdmin
                .from('inventory_items')
                .update({ quantity_on_hand: 0 })
                .neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) throw error;
            successCount++;
        } catch (e: any) {
            if (!e.message?.includes('Could not find the table')) {
                errors.push(`تصفير المخزون: ${e.message}`);
            }
        }

        // 9. Delete all payroll records (skip if table doesn't exist)
        try {
            await supabaseAdmin.from('payroll_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            successCount++;
        } catch (e: any) {
            // Silently skip if table doesn't exist
        }

        // 10. Delete all fixed assets and depreciation schedules
        try {
            await supabaseAdmin.from('depreciation_schedule').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabaseAdmin.from('fixed_assets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            successCount++;
        } catch (e: any) {
            if (!e.message?.includes('Could not find the table')) {
                errors.push(`الأصول الثابتة: ${e.message}`);
            }
        }

        // 11. Reset all account balances to zero (after deleting all transactions)
        try {
            const { error } = await supabaseAdmin
                .from('accounts')
                .update({ current_balance: 0 })
                .neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) throw error;
            successCount++;
        } catch (e: any) {
            if (!e.message?.includes('Could not find the table')) {
                errors.push(`تصفير أرصدة الحسابات: ${e.message}`);
            }
        }

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

        if (errors.length > 0) {
            return {
                success: false,
                error: `تمت بعض العمليات (${successCount}) لكن حدثت أخطاء: ${errors.join(', ')}`
            };
        }

        return {
            success: true,
            message: `تم تصفير جميع البيانات المحاسبية بنجاح (${successCount} عملية)`
        };

    } catch (error: any) {
        console.error('Error formatting accounting data:', error);
        return {
            success: false,
            error: error.message || 'حدث خطأ غير متوقع أثناء تصفير البيانات'
        };
    }
}
