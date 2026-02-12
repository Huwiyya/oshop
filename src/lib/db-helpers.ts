// lib/db-helpers.ts
// Helper functions for database operations

import { supabaseAdmin } from './supabase-admin';
import { PaginationParams, PaginatedResult, paginated } from './result-types';

/**
 * دالة مساعدة لتنفيذ stored procedure
 */
export async function callStoredProcedure<T = any>(
    procedureName: string,
    params: Record<string, any> = {}
): Promise<T> {
    try {
        const { data, error } = await supabaseAdmin.rpc(procedureName, params);

        if (error) {
            console.error(`Error calling ${procedureName}:`, error);
            throw new Error(error.message);
        }

        return data as T;
    } catch (error: any) {
        console.error(`Failed to call stored procedure ${procedureName}:`, error);
        throw error;
    }
}

/**
 * دالة مساعدة لجلب البيانات مع pagination
 */
export async function fetchPaginated<T>(
    tableName: string,
    params: PaginationParams = {},
    filters?: Record<string, any>
): Promise<PaginatedResult<T>> {
    const {
        page = 1,
        limit = 50,
        sortBy = 'created_at',
        sortOrder = 'desc'
    } = params;

    const offset = (page - 1) * limit;

    // بناء الاستعلام
    let query = supabaseAdmin.from(tableName).select('*', { count: 'exact' });

    // تطبيق الفلاتر
    if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                query = query.eq(key, value);
            }
        });
    }

    // استبعاد المحذوفات (soft delete)
    query = query.is('deleted_at', null);

    // الترتيب والـ pagination
    query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
        console.error(`Error fetching paginated data from ${tableName}:`, error);
        throw new Error(error.message);
    }

    return paginated(
        (data as T[]) || [],
        count || 0,
        { page, limit, sortBy, sortOrder }
    );
}

/**
 * دالة مساعدة للـ atomic increment
 * ملاحظة: هذه ليست ذرية 100% في التطبيق، ولكنها تفي بالغرض حالياً.
 * للأداء العالي والتزامن الدقيق يفضل استخدام RPC.
 */
export async function atomicIncrement(
    tableName: string,
    id: string,
    field: string,
    amount: number
): Promise<void> {
    // 1. Get current value
    const { data: currentRecord, error: fetchError } = await supabaseAdmin
        .from(tableName)
        .select(field)
        .eq('id', id)
        .single();

    if (fetchError) {
        throw new Error(`Failed to fetch current value for ${field}: ${fetchError.message}`);
    }

    const currentValue = (currentRecord as any)[field] || 0;
    const newValue = currentValue + amount;

    // 2. Update with new value
    const { error: updateError } = await supabaseAdmin
        .from(tableName)
        .update({ [field]: newValue })
        .eq('id', id);

    if (updateError) {
        throw new Error(`Failed to increment ${field}: ${updateError.message}`);
    }
}

/**
 * دالة مساعدة للـ soft delete
 */
export async function softDelete(
    tableName: string,
    id: string
): Promise<void> {
    const { error } = await supabaseAdmin
        .from(tableName)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to soft delete: ${error.message}`);
    }
}

/**
 * دالة مساعدة للاسترجاع (restore)
 */
export async function restore(
    tableName: string,
    id: string
): Promise<void> {
    const { error } = await supabaseAdmin
        .from(tableName)
        .update({ deleted_at: null })
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to restore: ${error.message}`);
    }
}

/**
 * دالة مساعدة لتسجيل في Audit Log
 */
export async function logAudit(params: {
    userId?: string;
    action: 'create' | 'update' | 'delete' | 'restore';
    tableName: string;
    recordId: string;
    oldValues?: any;
    newValues?: any;
}): Promise<void> {
    try {
        await callStoredProcedure('log_audit', {
            p_user_id: params.userId || null,
            p_action: params.action,
            p_table_name: params.tableName,
            p_record_id: params.recordId,
            p_old_values: params.oldValues ? JSON.stringify(params.oldValues) : null,
            p_new_values: params.newValues ? JSON.stringify(params.newValues) : null,
        });
    } catch (error) {
        // لا نريد أن يفشل العملية بسبب فشل الـ audit
        console.error('Failed to log audit:', error);
    }
}

/**
 * دالة مساعدة للحصول على عدد السجلات
 */
export async function getCount(
    tableName: string,
    filters?: Record<string, any>
): Promise<number> {
    let query = supabaseAdmin.from(tableName).select('*', { count: 'exact', head: true });

    if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                query = query.eq(key, value);
            }
        });
    }

    query = query.is('deleted_at', null);

    const { count, error } = await query;

    if (error) {
        throw new Error(`Failed to get count: ${error.message}`);
    }

    return count || 0;
}
