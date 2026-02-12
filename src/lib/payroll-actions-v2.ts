
'use server';

import { supabaseAdmin } from './supabase-admin';
import { revalidatePath } from 'next/cache';

// --- Types ---
export type PayslipLineV2 = {
    id?: string;
    accountId: string;
    description: string;
    amount: number;
    type: 'earning' | 'deduction';
};

export type PayslipV2 = {
    id: string;
    slip_number: string;
    employee_id: string;
    employee_name: string;
    period_year: number;
    period_month: number;
    payment_date: string;
    basic_salary: number;
    net_salary: number;
    status: 'draft' | 'posted' | 'void';
    journal_entry_id?: string;
    lines: PayslipLineV2[];
};

// --- Actions ---

export async function getEmployeesV2() {
    // Fetch accounts under Employee Payable parent (EMPLOYEES_PAYABLE)
    const { data: systemAccount } = await supabaseAdmin
        .from('system_accounts')
        .select('account_id')
        .eq('key', 'EMPLOYEES_PAYABLE')
        .single();

    if (!systemAccount) {
        console.warn('System account EMPLOYEES_PAYABLE not found');
        return [];
    }

    const { data, error } = await supabaseAdmin
        .from('accounts_v2')
        .select('id, name_ar, name_en, code, current_balance, level')
        .eq('parent_id', systemAccount.account_id)
        .eq('is_active', true)
        .order('code');

    if (error) {
        console.error('Error fetching employees:', error);
        return [];
    }
    return data;
}

export async function upsertPayslipV2(data: {
    id?: string;
    employeeId: string;
    employeeName: string;
    year: number;
    month: number;
    paymentDate: string;
    lines: PayslipLineV2[];
}) {
    // 1. Validate
    if (!data.employeeId) throw new Error('Employee required');
    if (data.lines.length === 0) throw new Error('At least one line required');

    // 2. Calculate Header Totals
    const totalEarnings = data.lines.filter(l => l.type === 'earning').reduce((sum, l) => sum + l.amount, 0);
    const totalDeductions = data.lines.filter(l => l.type === 'deduction').reduce((sum, l) => sum + l.amount, 0);
    const netSalary = totalEarnings - totalDeductions;

    if (netSalary < 0) throw new Error('Net salary cannot be negative');

    // 3. Upsert Header
    let slipId = data.id;

    // Generate Slip Number if new (simple logic for now, or DB trigger/function)
    // We will let DB handle ID generation if null. 
    // For Slip Number, we need a function or logic. 
    // Let's use the existing 'generate_payroll_slip_number' function if available, or do it here.
    // We'll reuse the logic from V1 but clean. 
    // Actually, let's insert and let DB default generic values if needed, but we need slip_number header.

    let slipNumber = '';
    if (!slipId) {
        const { count } = await supabaseAdmin.from('payroll_slips').select('*', { count: 'exact', head: true });
        const seq = (count || 0) + 1;
        slipNumber = `PAY-${data.year}-${seq.toString().padStart(4, '0')}`;
    }

    const payload: any = {
        employee_id: data.employeeId,
        employee_name: data.employeeName,
        period_year: data.year,
        period_month: data.month,
        payment_date: data.paymentDate,
        basic_salary: totalEarnings, // Set basic_salary to total earnings
        net_salary: netSalary,
        updated_at: new Date().toISOString()
    };

    if (!slipId) {
        payload.created_by = null; // System or User ID if we had it
        payload.slip_number = slipNumber;
        payload.status = 'draft';

        const { data: newSlip, error } = await supabaseAdmin.from('payroll_slips').insert(payload).select('id').single();
        if (error) throw new Error(error.message);
        slipId = newSlip.id;
    } else {
        // Update
        const { error } = await supabaseAdmin.from('payroll_slips').update(payload).eq('id', slipId).eq('status', 'draft');
        if (error) throw new Error(error.message);
    }

    // 4. Replace Lines (Delete All & Insert)
    // Only if draft
    await supabaseAdmin.from('payroll_slip_lines').delete().eq('slip_id', slipId);

    const linesToInsert = data.lines.map(l => ({
        slip_id: slipId,
        account_id: l.accountId,
        description: l.description,
        amount: l.amount,
        type: l.type
    }));

    const { error: linesError } = await supabaseAdmin.from('payroll_slip_lines').insert(linesToInsert);
    if (linesError) throw new Error('Failed to save lines: ' + linesError.message);

    revalidatePath('/accounting/payroll');
    return { success: true, id: slipId };
}

export async function postPayslipV2(slipId: string) {
    // Call the V2 Atomic RPC
    const { data, error } = await supabaseAdmin.rpc('accept_payroll_slip_v2_rpc', {
        p_slip_id: slipId,
        p_journal_description: 'Payroll Posting' // Can be dynamic
    });

    if (error) throw new Error(error.message);

    revalidatePath('/accounting/payroll');
    return { success: true, journalId: data.journal_id };
}

export async function deletePayslipV2(slipId: string) {
    // Only delete if Draft
    const { error } = await supabaseAdmin.from('payroll_slips').delete().eq('id', slipId).eq('status', 'draft');
    if (error) throw new Error('Cannot delete: ' + error.message);

    revalidatePath('/accounting/payroll');
    return { success: true };
}

export async function getPayslipV2(id: string) {
    const { data: slip, error } = await supabaseAdmin
        .from('payroll_slips')
        .select(`*, lines:payroll_slip_lines(*)`)
        .eq('id', id)
        .single();

    if (error) return null;
    return slip;
}
