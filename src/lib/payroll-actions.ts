'use server';

import { supabaseAdmin } from './supabase-admin';
import { createJournalEntry, type JournalEntryLine } from './journal-actions';

// --- أنواع البيانات ---
export type SalaryComponent = {
    name: string;
    amount: number;
    accountId: string; // حساب المصروف (للاستحقاقات) أو حساب السلف (للاستقطاعات)
    type: 'earning' | 'deduction'; // استحقاق (+) أو استقطاع (-)
};

export type CreatePayslipData = {
    employeeId: string; // Employee's Ledger Account ID
    period: string; // e.g., "2024-02"
    paymentDate: string;

    // Earnings
    basicSalary: number;
    basicSalaryAccountId: string; // Expense Account

    overtime: number;
    overtimeAccountId: string; // Expense Account

    // Deductions
    absence: number; // المبلغ المخصوم للغياب
    absenceAccountId?: string; // Optional: Usually reduces expense or specific revenue? Or just ignore from Dr?
    // User said "Absence (-) Credit". Usually this reduces the Payable to employee. 
    // We will treat it as reduction from total payable, effectively not booking expense for it if we book Gross.
    // Wait, usually: Dr Salary Expense (Full) -> Cr Payable (Full).
    // If absent: Dr Salary Expense (Less) -> Cr Payable (Less).
    // Or: Dr Salary Expense (Full Contract) -> Cr Absence Deduction (Income/Contra) -> Cr Payable.
    // Let's implement flexible mapping.

    advances: number;
    advancesAccountId: string; // Asset Account (Employee Advances)

    otherDeductions: number;
    otherDeductionsNote?: string;

    notes?: string;
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

export async function createPayslip(data: CreatePayslipData, isDraft: boolean = false) {
    // 1. Calculate Net Salary
    const totalEarnings = data.basicSalary + data.overtime;
    // Note: Deductions should include 'otherDeductions'
    const totalDeductions = data.absence + data.advances + data.otherDeductions;
    const netSalary = totalEarnings - totalDeductions;

    if (netSalary < 0) throw new Error('لا يمكن أن يكون صافي الراتب بالسالب');

    // 2. Generate Slip Number (Simple timestamp based or text)
    // In production, use a sequence or count
    const slipNumber = `SLIP-${data.period.replace('-', '')}-${Date.now().toString().slice(-4)}`;

    // Get Employee Name for denormalization
    const { data: empAccount } = await supabaseAdmin.from('accounts').select('name_ar').eq('id', data.employeeId).single();
    const empName = empAccount?.name_ar || 'Unknown';

    try {
        // 3. Insert into payroll_slips
        const slipData = {
            slip_number: slipNumber,
            employee_id: data.employeeId,
            employee_name: empName,
            period_month: parseInt(data.period.split('-')[1]),
            period_year: parseInt(data.period.split('-')[0]),
            basic_salary: data.basicSalary,
            basic_salary_account_id: data.basicSalaryAccountId,
            overtime: data.overtime,
            overtime_account_id: data.overtimeAccountId,
            absences: data.absence,
            advances: data.advances,
            advances_account_id: data.advancesAccountId,
            deductions: data.otherDeductions, // Storing other deductions here
            net_salary: netSalary,
            employee_payable_account_id: data.employeeId,
            payment_status: 'unpaid',
            // Allowances not used in form yet, set 0
            allowances: 0,
            allowances_account_id: null,
            journal_entry_id: null // set later if posted
        };

        const { data: insertedSlip, error: slipError } = await supabaseAdmin
            .from('payroll_slips')
            .insert(slipData)
            .select()
            .single();

        if (slipError) throw new Error('فشل حفظ قسيمة الراتب: ' + slipError.message);

        // 4. If Draft, return success
        if (isDraft) {
            return { success: true, id: insertedSlip.id, message: 'تم حفظ المسودة بنجاح' };
        }

        // 5. If NOT Draft, Create Journal Entry
        // Prepare Journal Entry Lines
        const lines: JournalEntryLine[] = [];

        // Debit: Basic Salary Expense
        if (data.basicSalary > 0) {
            lines.push({
                accountId: data.basicSalaryAccountId,
                description: `راتب أساسي - ${data.period} - ${empName}`,
                debit: data.basicSalary,
                credit: 0
            });
        }

        // Debit: Overtime Expense
        if (data.overtime > 0) {
            lines.push({
                accountId: data.overtimeAccountId,
                description: `إضافي - ${data.period} - ${empName}`,
                debit: data.overtime,
                credit: 0
            });
        }

        // Credit: Absence (Contra Expense or Income) -> handled as credit specific account if provided
        if (data.absence > 0 && data.absenceAccountId && data.absenceAccountId !== 'none') {
            lines.push({
                accountId: data.absenceAccountId,
                description: `خصم غياب - ${data.period}`,
                debit: 0,
                credit: data.absence
            });
        } else if (data.absence > 0) {
            // If no specific account, we might need a default 'Miscellaneous Income' or reduce Expense?
            // Since we debited FULL Amount, but employee gets LESS. We need to credit SOMETHING to balance.
            // If user selected "None", maybe we should have REDUCED the Debit? 
            // But for now, let's assume valid accounting requires an account.
            // We will skip this check here as strict validation should be on UI or we error out if unbalanced?
            // `createJournalEntry` checks balance. So if we don't add a credit line, it will fail.
            // We'll throw error if no account provided for non-zero absence to force user selection.
            throw new Error('يجب تحديد حساب لخصم الغياب لضمان توازن القيد');
        }

        // Credit: Advances
        if (data.advances > 0) {
            if (!data.advancesAccountId) throw new Error('يجب تحديد حساب السلف');
            lines.push({
                accountId: data.advancesAccountId,
                description: `خصم سلفة - ${data.period}`,
                debit: 0,
                credit: data.advances
            });
        }

        // Credit: Other Deductions -> Need account!
        // The form doesn't have "Other Deductions Account". This is a flaw in current form.
        // We will assume for now it goes to "Other Revenues" or similar if we want to support it, 
        // OR we just throw error saying "not implemented fully".
        // BUT, usually "Other Deductions" might be penalties.
        // Let's assume for this specific execution, we map it to 'Absence Account' if available or require update.
        // To be safe and minimal change: We'll add it to Net Salary (Payable) if negative? No.
        // If otherDeductions > 0, we need a Credit line.
        // Let's assume for now we don't support "Other Deductions" accounting-wise without an account selector.
        // Override: We will instruct user in UI to use "Absence" for all penalties or add a selector.
        // For now, if otherDeductions > 0, we require absenceAccountId to serve double duty or specific logic.
        // Let's put it in Absence Account if exists.
        if (data.otherDeductions > 0) {
            if (!data.absenceAccountId || data.absenceAccountId === 'none') throw new Error('يجب تحديد حساب الخصومات (حقل الغياب/الجزاءات) لتغطية الاستقطاعات الأخرى');
            lines.push({
                accountId: data.absenceAccountId,
                description: `استقطاعات أخرى - ${data.period}`,
                debit: 0,
                credit: data.otherDeductions
            });
        }

        // Credit: Net Salary (Payable)
        lines.push({
            accountId: data.employeeId,
            description: `صافي راتب مستحق - ${data.period} - ${empName}`,
            debit: 0,
            credit: netSalary
        });

        // 5. If NOT Draft, Create Journal Entry
        // Use RPC for atomic creation
        const { data: journalId, error: journalError } = await supabaseAdmin.rpc('create_journal_entry_rpc', {
            entry_date: data.paymentDate || new Date().toISOString(),
            description: `رواتب شهر ${data.period} - ${empName}`,
            reference_type: 'payroll',
            reference_id: insertedSlip.id,
            lines: lines
        });

        if (journalError) {
            throw new Error('فشل إنشاء قيد الرواتب: ' + journalError.message);
        }

        // Update Slip with Journal ID
        await supabaseAdmin.from('payroll_slips').update({ journal_entry_id: journalId }).eq('id', insertedSlip.id);

        return { success: true, id: insertedSlip.id, journalId, message: 'تم اعتماد القسيمة وترحيل القيد بنجاح' };


    } catch (error: any) {
        throw new Error(error.message);
    }
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
