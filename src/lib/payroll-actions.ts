'use server';

import { supabaseAdmin } from './supabase-admin';
import { createJournalEntry, type JournalEntryLine } from './journal-actions';

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

// --- دوال الموظفين ---

export async function getEmployees() {
    // We fetch accounts under "Accrued Salaries" or a specific parent for employees
    // Let's assume a parent code '2130' for "Accrued Salaries / Employees Payable"
    const parentCode = '2130';
    const { data: parent } = await supabaseAdmin.from('accounts').select('id').eq('account_code', parentCode).single();

    if (!parent) return [];

    const { data, error } = await supabaseAdmin
        .from('accounts')
        .select('*')
        .eq('parent_id', parent.id)
        .order('created_at', { ascending: false });

    if (error) return [];
    return data;
}

export async function createEmployee(data: { name_ar: string; phone?: string; salary?: number }) {
    try {
        // 1. Get Parent Account (Liabilities -> Accrued Salaries)
        const parentCode = '2130';
        const { data: parent } = await supabaseAdmin.from('accounts').select('id, account_code').eq('account_code', parentCode).single();
        if (!parent) throw new Error('Parent account for employees (2130) not found');

        // 2. Generate Code
        const { data: lastChild } = await supabaseAdmin
            .from('accounts')
            .select('account_code')
            .eq('parent_id', parent.id)
            .order('account_code', { ascending: false })
            .limit(1)
            .single();

        let newCode;
        if (lastChild) {
            newCode = (parseInt(lastChild.account_code) + 1).toString();
        } else {
            newCode = parent.account_code + '001';
        }

        // 3. Create Account
        const { data: newAccount, error } = await supabaseAdmin
            .from('accounts')
            .insert({
                name_ar: data.name_ar,
                account_code: newCode,
                parent_id: parent.id,
                account_type_id: 'type_liability',
                level: 3,
                is_parent: false,
                description: `Salary: ${data.salary || 0} - Phone: ${data.phone || ''}`
            })
            .select()
            .single();

        if (error) return { success: false, error: error.message };
        return { success: true, data: newAccount };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- دوال الرواتب ---

export async function createPayslip(data: CreatePayslipData) {
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

    // If NOT Draft, Create Journal Entry
    if (!data.isDraft) {
        // Payroll Journal Entry Logic:
        // Debit: Salary Expense accounts (earnings)
        // Credit: Deduction accounts (e.g., insurance, taxes)
        // Credit: Employee Payable (net salary)

        const journalLines = data.lines.map(line => ({
            accountId: line.accountId,
            description: line.description,
            // Earnings (salary, bonus) = DEBIT to expense account
            // Deductions (insurance, taxes) = CREDIT to liability account
            debit: line.type === 'earning' ? line.amount : 0,
            credit: line.type === 'deduction' ? line.amount : 0
        }));

        // Add Payable to Employee (Credit Net Salary to liability account)
        journalLines.push({
            accountId: data.employeeId,
            description: `صافي راتب مستحق - ${data.period}`,
            debit: 0,
            credit: data.netSalary
        });

        const { data: journalId, error: journalError } = await supabaseAdmin.rpc('create_journal_entry_rpc', {
            p_entry_date: data.paymentDate,
            p_description: `رواتب شهر ${data.period} - ${data.employeeName}`,
            p_reference_type: 'payroll',
            p_reference_id: result,
            p_lines: journalLines
        });

        if (journalError) throw new Error('فشل إنشاء قيد الرواتب: ' + journalError.message);

        await supabaseAdmin.from('payroll_slips').update({ journal_entry_id: journalId, is_draft: false }).eq('id', result);
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
    return slip;
}

export async function getExpenseAccounts() {
    // 5xxx Expenses
    const { data } = await supabaseAdmin.from('accounts').select('*').like('account_code', '5%').order('account_code');
    return data || [];
}

export async function getAssetAccounts() {
    // 1xxx Assets (for Advances)
    const { data } = await supabaseAdmin.from('accounts').select('*').like('account_code', '1%').order('account_code');
    return data || [];
}

/**
 * Update Employee Account
 */
export async function updateEmployee(id: string, data: { name_ar: string; phone?: string; salary?: number }) {
    try {
        const { data: account, error } = await supabaseAdmin
            .from('accounts')
            .update({
                name_ar: data.name_ar,
                description: `Salary: ${data.salary || 0} - Phone: ${data.phone || ''}`
            })
            .eq('id', id)
            .select()
            .single();

        if (error) return { success: false, error: error.message };
        return { success: true, data: account };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Delete Employee Account
 * Validates that employee has no payroll records before deletion
 */
export async function deleteEmployee(id: string) {
    try {
        // Check if employee has payroll records/slips
        const { data: payrollRecords } = await supabaseAdmin
            .from('payroll_records')
            .select('id')
            .eq('employee_id', id)
            .limit(1);

        if (payrollRecords && payrollRecords.length > 0) {
            return {
                success: false,
                error: 'لا يمكن حذف موظف مرتبط بسجلات رواتب. يرجى حذف سجلات الرواتب أولاً.'
            };
        }

        // Check if employee has journal entries (via account_transactions or journal_entry_lines)
        const { data: transactions } = await supabaseAdmin
            .from('journal_entry_lines')
            .select('id')
            .eq('account_id', id)
            .limit(1);

        if (transactions && transactions.length > 0) {
            return {
                success: false,
                error: 'لا يمكن حذف موظف مرتبط بقيود محاسبية. يرجى حذف القيود أولاً.'
            };
        }

        // Delete the employee account
        const { error } = await supabaseAdmin
            .from('accounts')
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
    const { data, error } = await supabaseAdmin.rpc('delete_payroll_slip_rpc', {
        p_slip_id: id
    });

    if (error) throw new Error(error.message);
    return data;
}
