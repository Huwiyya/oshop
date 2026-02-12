// lib/validation.ts
// Validation schemas using Zod

import { z } from 'zod';

// =====================================================
// Order Validation Schemas
// =====================================================

export const orderSchema = z.object({
    userId: z.string().min(1, "معرف المستخدم مطلوب"),
    customerName: z.string().min(2, "اسم العميل يجب أن يكون حرفين على الأقل"),
    sellingPriceLYD: z.number()
        .min(0.01, "السعر يجب أن يكون أكبر من صفر")
        .max(1000000, "السعر غير معقول"),
    purchasePriceUSD: z.number()
        .min(0, "سعر الشراء لا يمكن أن يكون سالباً")
        .optional(),
    downPaymentLYD: z.number()
        .min(0, "الدفعة المقدمة لا يمكن أن تكون سالبة")
        .optional()
        .default(0),
    weightKG: z.number()
        .min(0, "الوزن لا يمكن أن يكون سالباً")
        .max(1000, "الوزن يجب أن يكون أقل من 1000 كجم")
        .optional(),
    exchangeRate: z.number()
        .min(0.1, "سعر الصرف غير صحيح")
        .max(100, "سعر الصرف غير معقول")
        .optional(),
    productLinks: z.string().optional(),
    itemDescription: z.string().optional(),
    status: z.enum([
        'pending', 'processed', 'ready', 'shipped',
        'arrived_misrata', 'out_for_delivery', 'delivered',
        'cancelled', 'paid', 'returned'
    ]).optional(),
    paymentMethod: z.enum(['cash', 'card', 'cash_dollar']).optional(),
}).refine(
    (data) => {
        // التحقق من أن الدفعة المقدمة لا تزيد عن السعر الكلي
        if (data.downPaymentLYD && data.downPaymentLYD > data.sellingPriceLYD) {
            return false;
        }
        return true;
    },
    {
        message: "الدفعة المقدمة لا يمكن أن تكون أكبر من السعر الكلي",
        path: ["downPaymentLYD"]
    }
);

export const updateOrderWeightSchema = z.object({
    orderId: z.string().min(1, "معرف الطلب مطلوب"),
    weightKG: z.number()
        .min(0.01, "الوزن يجب أن يكون أكبر من صفر")
        .max(1000, "الوزن يجب أن يكون أقل من 1000 كجم"),
    costPrice: z.number()
        .min(0, "سعر التكلفة لا يمكن أن يكون سالباً"),
    sellingPrice: z.number()
        .min(0, "سعر البيع لا يمكن أن يكون سالباً"),
    costCurrency: z.enum(['LYD', 'USD']).default('LYD'),
    sellingCurrency: z.enum(['LYD', 'USD']).default('LYD'),
}).refine(
    (data) => data.sellingPrice >= data.costPrice,
    {
        message: "سعر البيع يجب أن يكون أكبر من أو يساوي سعر التكلفة",
        path: ["sellingPrice"]
    }
);

// =====================================================
// User Validation Schemas
// =====================================================

export const userSchema = z.object({
    name: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
    username: z.string().min(3, "اسم المستخدم يجب أن يكون 3 أحرف على الأقل"),
    password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل").optional(),
    phone: z.string()
        .min(10, "رقم الهاتف غير صحيح")
        .regex(/^[0-9+\s()-]+$/, "رقم الهاتف يحتوي على أحرف غير صحيحة"),
    address: z.string().optional(),
});

export const updateUserSchema = userSchema.partial();

// =====================================================
// Wallet Validation Schemas
// =====================================================

export const walletDepositSchema = z.object({
    userId: z.string().min(1, "معرف المستخدم مطلوب"),
    amount: z.number()
        .min(0.01, "المبلغ يجب أن يكون أكبر من صفر")
        .max(1000000, "المبلغ غير معقول"),
    paymentMethod: z.enum(['cash', 'bank', 'other']).default('cash'),
    description: z.string().optional(),
});

export const walletWithdrawalSchema = z.object({
    userId: z.string().min(1, "معرف المستخدم مطلوب"),
    amount: z.number()
        .min(0.01, "المبلغ يجب أن يكون أكبر من صفر"),
    description: z.string().optional(),
});

// =====================================================
// Treasury Validation Schemas
// =====================================================

export const treasuryTransactionSchema = z.object({
    amount: z.number()
        .min(0.01, "المبلغ يجب أن يكون أكبر من صفر")
        .max(10000000, "المبلغ غير معقول"),
    type: z.enum(['deposit', 'withdrawal']),
    channel: z.enum(['cash', 'bank']).optional(),
    cardId: z.string().optional(),
    description: z.string().min(1, "الوصف مطلوب"),
    relatedOrderId: z.string().optional(),
});

// =====================================================
// Shein Card Validation Schemas
// =====================================================

export const sheinCardSchema = z.object({
    code: z.string().min(1, "رمز البطاقة مطلوب"),
    value: z.number()
        .min(0.01, "قيمة البطاقة يجب أن تكون أكبر من صفر"),
    currency: z.enum(['USD']).default('USD'),
    status: z.enum(['available', 'used', 'expired']).default('available'),
    purchaseDate: z.string(),
    expiryDate: z.string().optional(),
    notes: z.string().optional(),
});

// =====================================================
// Representative Validation Schemas
// =====================================================

export const representativeSchema = z.object({
    name: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
    username: z.string().min(3, "اسم المستخدم يجب أن يكون 3 أحرف على الأقل"),
    password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
    phone: z.string()
        .min(10, "رقم الهاتف غير صحيح")
        .regex(/^[0-9+\s()-]+$/, "رقم الهاتف يحتوي على أحرف غير صحيحة"),
});

// =====================================================
// Settings Validation Schemas
// =====================================================

export const systemSettingsSchema = z.object({
    exchangeRate: z.number()
        .min(0.1, "سعر الصرف غير صحيح")
        .max(100, "سعر الصرف غير معقول"),
    shippingExchangeRate: z.number()
        .min(0.1, "سعر صرف الشحن غير صحيح")
        .max(100, "سعر صرف الشحن غير معقول")
        .optional(),
    shippingCostUSD: z.number()
        .min(0, "تكلفة الشحن لا يمكن أن تكون سالبة")
        .optional(),
    shippingPriceUSD: z.number()
        .min(0, "سعر الشحن لا يمكن أن يكون سالباً")
        .optional(),
});

// =====================================================
// Pagination Validation
// =====================================================

export const paginationSchema = z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(50),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// =====================================================
// Helper function to validate data
// =====================================================

export type ValidationResult<T> =
    | { success: true; data: T }
    | { success: false; error: string; errors?: z.ZodError };

export function validateData<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): ValidationResult<T> {
    try {
        const validatedData = schema.parse(data);
        return { success: true, data: validatedData };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
            return { success: false, error: errorMessage, errors: error };
        }
        return { success: false, error: 'خطأ في التحقق من البيانات' };
    }
}
