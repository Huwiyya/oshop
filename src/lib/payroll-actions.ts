'use server';

import { supabaseAdmin } from './supabase-admin';
import { createJournalEntryV2, createAtomicJournalEntryV2 } from './accounting-v2-actions';

// --- أنواع البيانات ---
export type PayslipLine = {
    accountId: string;
    description: string;
    amount: number;
    type: 'earning' | 'deduction';
};

export type CreatePayslipData = {
    slipId?: string; // Optional: for updating drafts
    employeeId: string;
    employeeName: string;
    period: string; // "YYYY-MM"
    paymentDate: string;
    basicSalary: number;
    netSalary: number;
    isDraft: boolean;
    lines: PayslipLine[];
};

// --- دوال الموظفين (V2) ---

export async function getEmployees() {
    // Fetch employees from V2 Accounts under 'Employees Payable' (2130)
    // 1. Find Parent
    const { data: parent } = await supabaseAdmin
        .from('accounts_v2')
        .select('id')
        .eq('code', '2130')
        .single();

    if (!parent) return [];

    const { data, error } = await supabaseAdmin
        .from('accounts_v2')
        .select('*')
        .eq('parent_id', parent.id)
        .order('created_at', { ascending: false });

    if (error) return [];

    // Map code to account_code for compatibility if needed by UI, but UI likely uses properties
    // Accounts V2 uses 'code', legacy used 'account_code'.
    // We map it to satisfy UI expectations if it relies on 'account_code'.
    return data.map(d => ({ ...d, account_code: d.code }));
}

export async function createEmployee(data: { name_ar: string; phone?: string; salary?: number }) {
    try {
        // 1. Get Parent Account (Employees Payable - 2130)
        const { data: parent } = await supabaseAdmin
            .from('accounts_v2')
            .select('*')
            .eq('code', '2130')
            .single();

        if (!parent) throw new Error('Parent account for employees (2130) not found in V2');

        // 2. Generate Code
        const { data: lastChild } = await supabaseAdmin
            .from('accounts_v2')
            .select('code')
            .eq('parent_id', parent.id)
            .order('code', { ascending: false })
            .limit(1)
            .single();

        let newCode;
        if (lastChild && lastChild.code) {
            // Assuming code is numeric 213001 etc.
            const numericPart = parseInt(lastChild.code);
            if (!isNaN(numericPart)) {
                newCode = (numericPart + 1).toString();
            } else {
                newCode = `${parent.code}001`;
            }
        } else {
            newCode = `${parent.code}001`;
        }

        // 3. Create Account V2
        const { data: newAccount, error } = await supabaseAdmin
            .from('accounts_v2')
            .insert({
                name_ar: data.name_ar,
                name_en: data.name_ar, // Fallback
                code: newCode,
                parent_id: parent.id,
                type_id: parent.type_id,
                level: parent.level + 1,
                is_group: false,
                current_balance: 0
            })
            .select()
            .single();

        if (error) return { success: false, error: error.message };

        // Return with 'account_code' alias for compatibility
        return { success: true, data: { ...newAccount, account_code: newAccount.code } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- دوال الرواتب (Migration to V2) ---

export async function createPayslip(data: CreatePayslipData) {
    // 1. Create Payslip Record (Legacy Table 'payroll_slips')
    // We keep using the RPC for creating the slip record itself as it handles logic for the slip table
    const { data: result, error } = await supabaseAdmin.rpc('create_payroll_slip_rpc', {
        p_slip_id: data.slipId || null,
        p_employee_id: data.employeeId,
        p_employee_name: data.employeeName,
        p_period_month: parseInt(data.period.split('-')[1]),
        p_period_year: parseInt(data.period.split('-')[0]),
        p_basic_salary: data.basicSalary,
        p_net_salary: data.netSalary,
        p_is_draft: data.isDraft,
        p_lines: data.lines,
        p_payment_date: data.paymentDate
    });

    if (error) throw new Error(error.message);

    // If NOT Draft, Create Journal Entry V2
    if (!data.isDraft) {
        // Payroll Journal Entry Logic:
        // Debit: Salary Expense accounts (earnings)
        // Credit: Deduction accounts (e.g., insurance, taxes)
        // Credit: Employee Payable (net salary)

        const journalLines = data.lines.map(line => ({
            account_id: line.accountId,
            description: line.description,
            debit: line.type === 'earning' ? Number(line.amount) : 0,
            credit: line.type === 'deduction' ? Number(line.amount) : 0
        }));

        // Add Payable to Employee (Credit Net Salary to liability account)
        journalLines.push({
            account_id: data.employeeId,
            description: `صافي راتب مستحق - ${data.period}`,
            debit: 0,
            credit: Number(data.netSalary)
        });

        // Use Atomic V2 Creation
        const journalRes = await createAtomicJournalEntryV2({
            date: data.paymentDate,
            description: `رواتب شهر ${data.period} - ${data.employeeName}`,
            lines: journalLines
        });

        if (!journalRes.success || !journalRes.data) {
            throw new Error('فشل إنشاء قيد الرواتب V2: ' + (journalRes.error || 'Unknown error'));
        }

        const journalId = journalRes.data.id;

        // Update payroll_slips with V2 Journal ID
        // Note: 'journal_entry_v2_id' must exist in payroll_slips (Created in previous step)
        await supabaseAdmin
            .from('payroll_slips')
            .update({
                journal_entry_v2_id: journalId,
                is_draft: false
            })
            .eq('id', result);
    }

    return result;
}

export async function getPayslips() {
    const { data, error } = await supabaseAdmin
        .from('payroll_slips')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
}

export async function getPayslipById(id: string) {
    const { data: slip, error: slipError } = await supabaseAdmin
        .from('payroll_slips')
        .select('*, payroll_slip_lines(*)')
        .eq('id', id)
        .single();

    if (slipError) throw new Error(slipError.message);

    // In V2, we might want to fetch linked Journal V2 if needed, but UI likely just shows the slip.
    return slip;
}

export async function getExpenseAccounts() {
    // 5xxx Expenses in V2
    const { data } = await supabaseAdmin
        .from('accounts_v2')
        .select('*')
        .like('code', '5%')
        .order('code');

    return data ? data.map(d => ({ ...d, account_code: d.code })) : [];
}

export async function getAssetAccounts() {
    // 1xxx Assets in V2
    const { data } = await supabaseAdmin
        .from('accounts_v2')
        .select('*')
        .like('code', '1%')
        .order('code');

    return data ? data.map(d => ({ ...d, account_code: d.code })) : [];
}

/**
 * Update Employee Account V2
 */
export async function updateEmployee(id: string, data: { name_ar: string; phone?: string; salary?: number }) {
    try {
        const { data: account, error } = await supabaseAdmin
            .from('accounts_v2')
            .update({
                name_ar: data.name_ar
            })
            .eq('id', id)
            .select()
            .single();

        if (error) return { success: false, error: error.message };
        return { success: true, data: { ...account, account_code: account.code } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Delete Employee Account V2
 */
export async function deleteEmployee(id: string) {
    try {
        // Check if employee has payroll records
        const { data: payrollRecords } = await supabaseAdmin
            .from('payroll_slips') // Changed from payroll_records (which might be wrong table name in legacy code? or alias?)
            // Assuming payroll_slips is the table. Legacy code had 'payroll_records' but 'createPayslip' used 'payroll_slips'.
            // Let's assume payroll_slips.
            .select('id')
            .eq('employee_id', id)
            .limit(1);

        if (payrollRecords && payrollRecords.length > 0) {
            return {
                success: false,
                error: 'لا يمكن حذف موظف مرتبط بسجلات رواتب. يرجى حذف سجلات الرواتب أولاً.'
            };
        }

        // Check journal lines V2
        const { count: txCount } = await supabaseAdmin
            .from('journal_lines_v2')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', id);

        if (txCount && txCount > 0) {
            return {
                success: false,
                error: 'لا يمكن حذف موظف مرتبط بقيود محاسبية (V2). يرجى حذف القيود أولاً.'
            };
        }

        // Delete the employee account in V2
        const { error } = await supabaseAdmin
            .from('accounts_v2')
            .delete()
            .eq('id', id);

        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Delete Payslip
 */
export async function deletePayslip(id: string) {
    // 1. Get Slip to find Journal ID
    const { data: slip } = await supabaseAdmin.from('payroll_slips').select('journal_entry_v2_id').eq('id', id).single();

    // 2. Delete Slip (RPC)
    const { data, error } = await supabaseAdmin.rpc('delete_payroll_slip_rpc', {
        p_slip_id: id
    });

    if (error) throw new Error(error.message);

    // 3. Delete V2 Journal if exists
    if (slip && slip.journal_entry_v2_id) {
        await supabaseAdmin.from('journal_entries_v2').delete().eq('id', slip.journal_entry_v2_id);
    }

    return data;
}
