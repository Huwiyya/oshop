'use server';

import { supabaseAdmin } from './supabase-admin';

/**
 * Comprehensive Accounting Fix - Application Layer
 * تحديثات طبقة التطبيق لاستخدام Database Functions الجديدة
 */

// ============================================
// Fix #1 & #3: Safe Delete with Balance Update & Audit Trail
// ============================================

export async function deleteJournalEntrySafe(
    journalEntryId: string,
    userId?: string,
    reason?: string
) {
    try {
        const { data, error } = await supabaseAdmin
            .rpc('safe_delete_journal_entry', {
                p_entry_id: journalEntryId,
                p_user_id: userId,
                p_reason: reason
            });

        if (error) {
            return { success: false, error: error.message };
        }

        // الـ RPC يرجع JSON
        if (data && typeof data === 'object') {
            return data;
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ============================================
// Fix #5: Validate Journal Entry Balance
// ============================================

export async function validateJournalEntryBalance(journalEntryId: string) {
    try {
        const { data, error } = await supabaseAdmin
            .rpc('validate_journal_entry_balance', {
                p_entry_id: journalEntryId
            });

        if (error) {
            return { valid: false, error: error.message };
        }

        return data;
    } catch (error: any) {
        return { valid: false, error: error.message };
    }
}

// ============================================
// Helper: Create Reversing Entry (for Posted Entries)
// ============================================

export async function createReversingEntry(
    originalEntryId: string,
    userId?: string,
    description?: string
) {
    try {
        const { data, error } = await supabaseAdmin
            .rpc('create_reversing_entry', {
                p_original_entry_id: originalEntryId,
                p_user_id: userId,
                p_description: description
            });

        if (error) {
            return { success: false, error: error.message };
        }

        return data;
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ============================================
// Fix #6: Thread-Safe Balance Update
// ============================================

export async function updateAccountBalanceSafe(
    accountId: string,
    amount: number,
    operation: 'ADD' | 'SUBTRACT' = 'ADD'
) {
    try {
        const { data, error } = await supabaseAdmin
            .rpc('update_account_balance', {
                p_account_id: accountId,
                p_amount: amount,
                p_operation: operation
            });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ============================================
// Enhanced: Create Journal Entry with Validation
// ============================================

export async function createJournalEntryValidated(data: {
    entry_number: string;
    entry_date: string;
    description: string;
    lines: Array<{
        account_id: string;
        description?: string;
        debit: number;
        credit: number;
    }>;
    reference_type?: string;
    reference_id?: string;
    user_id?: string;
}) {
    try {
        // 1. Validate balance BEFORE creating
        const totalDebit = data.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
        const totalCredit = data.lines.reduce((sum, l) => sum + (l.credit || 0), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            return {
                success: false,
                error: `القيد غير متوازن: المدين (${totalDebit}) ≠ الدائن (${totalCredit})`
            };
        }

        // 2. Create entry in transaction
        const { data: entry, error: entryError } = await supabaseAdmin
            .from('journal_entries')
            .insert({
                entry_number: data.entry_number,
                entry_date: data.entry_date,
                description: data.description,
                reference_type: data.reference_type,
                reference_id: data.reference_id,
                is_posted: false,
                created_by: data.user_id,
                total_debit: totalDebit,
                total_credit: totalCredit
            })
            .select()
            .single();

        if (entryError) {
            return { success: false, error: entryError.message };
        }

        // 3. Create lines
        const linesToInsert = data.lines.map((line, index) => ({
            journal_entry_id: entry.id,
            entry_id: entry.id,
            account_id: line.account_id,
            description: line.description,
            debit: line.debit || 0,
            credit: line.credit || 0,
            line_number: index + 1
        }));

        const { error: linesError } = await supabaseAdmin
            .from('journal_entry_lines')
            .insert(linesToInsert);

        if (linesError) {
            // Rollback by deleting entry
            await supabaseAdmin
                .from('journal_entries')
                .delete()
                .eq('id', entry.id);

            return { success: false, error: linesError.message };
        }

        // 4. Log to audit
        await supabaseAdmin.from('audit_log').insert({
            table_name: 'journal_entries',
            record_id: entry.id,
            action: 'INSERT',
            new_values: entry,
            user_id: data.user_id
        });

        // Note: Balance update happens automatically via trigger!

        return { success: true, data: entry };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ============================================
// Get Audit Log for a Record
// ============================================

export async function getAuditLog(tableName: string, recordId: string) {
    try {
        const { data, error } = await supabaseAdmin
            .from('audit_log')
            .select('*')
            .eq('table_name', tableName)
            .eq('record_id', recordId)
            .order('created_at', { ascending: false });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
