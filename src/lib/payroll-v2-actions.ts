'use server';

import { supabaseAdmin as supabase } from './supabase-admin';
import { revalidatePath } from 'next/cache';

export interface PayrollRunV2 {
    id: string;
    run_number: string; // e.g., 'PAY-2024-01'
    date: string;
    month: string;
    total_gross: number;
    total_deductions: number;
    total_net: number;
    status: 'draft' | 'posted';
    journal_entry_id: string | null;
    created_at: string;

    // Relations
    payment_account?: { name_ar: string; name_en: string };
    expense_account?: { name_ar: string; name_en: string };
    items?: PayrollItemV2[];
}

export interface PayrollItemV2 {
    id: string;
    employee_name: string;
    basic_salary: number;
    allowances: number;
    deductions: number;
    bonuses: number;
    gross_salary: number;
    net_salary: number;
}

// =============================================================================
// PAYROLL ACTIONS
// =============================================================================

export async function getPayrollRunsV2() {
    const { data, error } = await supabase
        .from('payroll_runs_v2')
        .select(`
            *,
            payment_account:payment_account_id (name_ar, name_en),
            expense_account:expense_account_id (name_ar, name_en)
        `)
        .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as PayrollRunV2[] };
}

export async function createPayrollRunV2(input: {
    date: string;
    month: string; // YYYY-MM
    payment_account_id: string;
    expense_account_id: string;
    items: {
        employee_name: string;
        basic_salary: number;
        allowances: number;
        deductions: number;
        bonuses: number;
    }[];
}) {
    // 1. Calculate Totals
    const totalGross = input.items.reduce((sum, item) => sum + item.basic_salary + item.allowances + item.bonuses, 0); // Note: bonuses included in gross expense usually? Schema says gross = basic + allowances. Let's align with schema or update schema logic.
    // Schema definition for Payroll Item: gross_salary GENERATED ALWAYS AS (basic_salary + allowances) STORED.
    // Wait, bonuses are usually part of gross. Let's check schema definition again.
    // "gross_salary DECIMAL(20, 4) GENERATED ALWAYS AS (basic_salary + allowances) STORED"
    // "net_salary ... (basic_salary + allowances + bonuses - deductions)"
    // So bonuses are added after gross? That's unusual but let's stick to schema/simplicity.
    // Actually, let's fix the logic in code to match "Total Gross" on header.
    // Header Total Gross should likely be the sum of all payments to employees + taxes?
    // Let's assume Total Gross = sum(basic + allowances + bonuses) for the run header to be useful.

    const totalBasicAllowances = input.items.reduce((sum, item) => sum + item.basic_salary + item.allowances, 0);
    const totalBonuses = input.items.reduce((sum, item) => sum + item.bonuses, 0);
    const totalDeductions = input.items.reduce((sum, item) => sum + item.deductions, 0);

    // Schema: total_gross, total_deductions.
    // Let's interpret total_gross as the full expense amount.
    const runTotalGross = totalBasicAllowances + totalBonuses;

    const runNumber = `RUN-${input.month}-${Date.now().toString().slice(-4)}`;

    // 2. Insert Header
    const { data: header, error: headerError } = await supabase
        .from('payroll_runs_v2')
        .insert({
            run_number: runNumber,
            date: input.date,
            month: input.month,
            payment_account_id: input.payment_account_id,
            expense_account_id: input.expense_account_id,
            total_gross: runTotalGross,
            total_deductions: totalDeductions,
            status: 'posted' // Auto-post
        })
        .select()
        .single();

    if (headerError) return { success: false, error: headerError.message };

    // 3. Insert Items
    const lines = input.items.map(item => ({
        payroll_run_id: header.id,
        employee_name: item.employee_name,
        basic_salary: item.basic_salary,
        allowances: item.allowances,
        deductions: item.deductions,
        bonuses: item.bonuses
    }));

    const { error: linesError } = await supabase
        .from('payroll_items_v2')
        .insert(lines);

    if (linesError) {
        return { success: false, error: 'Header created but items failed: ' + linesError.message };
    }

    revalidatePath('/accounting/payroll-v2');
    revalidatePath('/accounting/journal-v2');
    return { success: true, data: header };
}
