// lib/improved-actions.ts
// دوال محسّنة تستخدم stored procedures و validation

'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import {
    callStoredProcedure,
    fetchPaginated,
    logAudit,
    softDelete,
    restore
} from './db-helpers';
import {
    orderSchema,
    updateOrderWeightSchema,
    walletDepositSchema,
    validateData
} from './validation';
import { Result, ok, err, PaginatedResult, PaginationParams } from './result-types';
import { Order, User, TreasuryCard } from './types';
import { supabaseAdmin } from './supabase-admin';

// =====================================================
// Helper: الحصول على معلومات المستخدم الحالي
// =====================================================
async function getCurrentUserId(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get('userId')?.value || null;
}

// =====================================================
// IMPROVED: إضافة طلب بشكل ذري
// =====================================================
export async function addOrderAtomic(
    orderData: any
): Promise<Result<Order>> {
    try {
        // 1. التحقق من صحة البيانات
        const validation = validateData(orderSchema, orderData);
        if (!validation.success) {
            return err(validation.error);
        }

        const validData = validation.data;
        const managerId = await getCurrentUserId();

        // 2. استدعاء stored procedure
        const result = await callStoredProcedure<{
            success: boolean;
            orderId: string;
            remainingAmount: number;
        }>('create_order_atomic', {
            p_order_data: JSON.stringify(validData),
            p_user_id: validData.userId,
            p_down_payment: validData.downPaymentLYD || 0,
            p_payment_method: validData.paymentMethod || 'cash',
            p_manager_id: managerId
        });

        if (!result.success) {
            return err('فشل إنشاء الطلب');
        }

        // 3. جلب الطلب المُنشأ
        const { data: order, error } = await supabaseAdmin
            .from('orders_v4')
            .select('*')
            .eq('id', result.orderId)
            .single();

        if (error || !order) {
            return err('تم إنشاء الطلب لكن فشل جلب البيانات');
        }

        // 4. Revalidate
        revalidatePath('/admin/orders');
        revalidatePath('/dashboard');

        return ok(order as Order);

    } catch (error: any) {
        console.error('Error in addOrderAtomic:', error);
        return err(error.message || 'حدث خطأ غير متوقع');
    }
}

// =====================================================
// IMPROVED: حذف طلب بشكل ذري (Soft Delete)
// =====================================================
export async function deleteOrderAtomic(
    orderId: string
): Promise<Result<{ refundedAmount: number; debtReduced: number }>> {
    try {
        const managerId = await getCurrentUserId();

        // استدعاء stored procedure
        const result = await callStoredProcedure<{
            success: boolean;
            refundedAmount: number;
            debtReduced: number;
        }>('delete_order_atomic', {
            p_order_id: orderId,
            p_manager_id: managerId
        });

        if (!result.success) {
            return err('فشل حذف الطلب');
        }

        revalidatePath('/admin/orders');
        revalidatePath('/dashboard');

        return ok({
            refundedAmount: result.refundedAmount,
            debtReduced: result.debtReduced
        });

    } catch (error: any) {
        console.error('Error in deleteOrderAtomic:', error);
        return err(error.message || 'حدث خطأ في حذف الطلب');
    }
}

// =====================================================
// IMPROVED: تحديث وزن الطلب بشكل ذري
// =====================================================
export async function updateOrderWeightAtomic(
    orderId: string,
    weightKG: number,
    costPrice: number,
    sellingPrice: number,
    costCurrency: 'LYD' | 'USD' = 'LYD',
    sellingCurrency: 'LYD' | 'USD' = 'LYD'
): Promise<Result<{ costDifference: number; newDebt: number }>> {
    try {
        // 1. التحقق من صحة البيانات
        const validation = validateData(updateOrderWeightSchema, {
            orderId,
            weightKG,
            costPrice,
            sellingPrice,
            costCurrency,
            sellingCurrency
        });

        if (!validation.success) {
            return err(validation.error);
        }

        const managerId = await getCurrentUserId();

        // 2. استدعاء stored procedure
        const result = await callStoredProcedure<{
            success: boolean;
            costDifference: number;
            newDebt: number;
        }>('update_order_weight_atomic', {
            p_order_id: orderId,
            p_weight_kg: weightKG,
            p_cost_price: costPrice,
            p_selling_price: sellingPrice,
            p_cost_currency: costCurrency,
            p_selling_currency: sellingCurrency,
            p_manager_id: managerId
        });

        if (!result.success) {
            return err('فشل تحديث الوزن');
        }

        revalidatePath('/admin/orders');
        revalidatePath(`/admin/orders/${orderId}`);

        return ok({
            costDifference: result.costDifference,
            newDebt: result.newDebt
        });

    } catch (error: any) {
        console.error('Error in updateOrderWeightAtomic:', error);
        return err(error.message || 'حدث خطأ في تحديث الوزن');
    }
}

// =====================================================
// IMPROVED: جلب الطلبات مع Pagination
// =====================================================
export async function getOrdersPaginated(
    params: PaginationParams = {},
    filters?: { userId?: string; status?: string; representativeId?: string }
): Promise<PaginatedResult<Order>> {
    try {
        return await fetchPaginated<Order>(
            'orders_v4',
            {
                page: params.page || 1,
                limit: params.limit || 50,
                sortBy: params.sortBy || 'created_at',
                sortOrder: params.sortOrder || 'desc'
            },
            filters
        );
    } catch (error: any) {
        console.error('Error in getOrdersPaginated:', error);
        // إرجاع نتيجة فارغة بدلاً من throw
        return {
            data: [],
            pagination: {
                page: 1,
                limit: 50,
                total: 0,
                totalPages: 0,
                hasNext: false,
                hasPrev: false
            }
        };
    }
}

// =====================================================
// IMPROVED: جلب المستخدمين مع Pagination
// =====================================================
export async function getUsersPaginated(
    params: PaginationParams = {}
): Promise<PaginatedResult<User>> {
    try {
        return await fetchPaginated<User>(
            'users_v4',
            {
                page: params.page || 1,
                limit: params.limit || 50,
                sortBy: params.sortBy || 'created_at',
                sortOrder: params.sortOrder || 'desc'
            }
        );
    } catch (error: any) {
        console.error('Error in getUsersPaginated:', error);
        return {
            data: [],
            pagination: {
                page: 1,
                limit: 50,
                total: 0,
                totalPages: 0,
                hasNext: false,
                hasPrev: false
            }
        };
    }
}

// =====================================================
// IMPROVED: إعادة حساب إحصائيات المستخدم بشكل ذري
// =====================================================
export async function recalculateUserStatsAtomic(
    userId: string
): Promise<Result<{ totalDebt: number; orderCount: number }>> {
    try {
        const result = await callStoredProcedure<{
            success: boolean;
            totalDebt: number;
            orderCount: number;
        }>('recalculate_user_stats_atomic', {
            p_user_id: userId
        });

        if (!result.success) {
            return err('فشل إعادة حساب الإحصائيات');
        }

        revalidatePath(`/admin/users/${userId}`);
        revalidatePath('/admin/users');

        return ok({
            totalDebt: result.totalDebt,
            orderCount: result.orderCount
        });

    } catch (error: any) {
        console.error('Error in recalculateUserStatsAtomic:', error);
        return err(error.message || 'حدث خطأ في إعادة الحساب');
    }
}

// =====================================================
// IMPROVED: إضافة رصيد للمحفظة بشكل ذري
// =====================================================
export async function addWalletBalanceAtomic(
    userId: string,
    amount: number,
    paymentMethod: 'cash' | 'bank' | 'other' = 'cash',
    description: string = ''
): Promise<Result<{ newBalance: number; transactionId: string }>> {
    try {
        // 1. التحقق من صحة البيانات
        const validation = validateData(walletDepositSchema, {
            userId,
            amount,
            paymentMethod,
            description
        });

        if (!validation.success) {
            return err(validation.error);
        }

        const managerId = await getCurrentUserId();

        // 2. استدعاء stored procedure
        const result = await callStoredProcedure<{
            success: boolean;
            newBalance: number;
            transactionId: string;
        }>('add_wallet_balance_atomic', {
            p_user_id: userId,
            p_amount: amount,
            p_payment_method: paymentMethod,
            p_description: description,
            p_manager_id: managerId
        });

        if (!result.success) {
            return err('فشل إضافة الرصيد');
        }

        revalidatePath(`/admin/users/${userId}`);

        return ok({
            newBalance: result.newBalance,
            transactionId: result.transactionId
        });

    } catch (error: any) {
        console.error('Error in addWalletBalanceAtomic:', error);
        return err(error.message || 'حدث خطأ في إضافة الرصيد');
    }
}

// =====================================================
// IMPROVED: استرجاع طلب محذوف (Restore)
// =====================================================
export async function restoreOrder(
    orderId: string
): Promise<Result<boolean>> {
    try {
        const managerId = await getCurrentUserId();

        await restore('orders_v4', orderId);

        // تسجيل في Audit Log
        await logAudit({
            userId: managerId || undefined,
            action: 'restore',
            tableName: 'orders_v4',
            recordId: orderId
        });

        revalidatePath('/admin/orders');

        return ok(true);

    } catch (error: any) {
        console.error('Error in restoreOrder:', error);
        return err(error.message || 'حدث خطأ في استرجاع الطلب');
    }
}

// =====================================================
// دالة للحصول على جميع الطلبات المحذوفة
// =====================================================
export async function getDeletedOrders(): Promise<Order[]> {
    try {
        const { data, error } = await supabaseAdmin
            .from('orders_v4')
            .select('*')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });

        if (error) throw error;

        return (data as Order[]) || [];

    } catch (error: any) {
        console.error('Error in getDeletedOrders:', error);
        return [];
    }
}

// =====================================================
// دالة للحصول على Audit Log لسجل معين
// =====================================================
export async function getAuditLog(
    tableName: string,
    recordId: string
): Promise<any[]> {
    try {
        const { data, error } = await supabaseAdmin
            .from('audit_log')
            .select('*')
            .eq('table_name', tableName)
            .eq('record_id', recordId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data || [];

    } catch (error: any) {
        console.error('Error in getAuditLog:', error);
        return [];
    }
}
