# دليل تطبيق الإصلاحات - نظام Oshop

## 📋 نظرة عامة

تم إنشاء مجموعة من الملفات لإصلاح المشاكل الموجودة في النظام. هذا الدليل يشرح كيفية تطبيق هذه الإصلاحات خطوة بخطوة.

---

## 🗂️ الملفات المُنشأة

### 1. ملفات SQL (قاعدة البيانات)

#### [`atomic_procedures.sql`](file:///c:/Huwiyya/shipping/Oshop/atomic_procedures.sql)
**الوصف**: Stored procedures للمعاملات الذرية  
**يحتوي على**:
- `create_order_atomic()` - إنشاء طلب بشكل ذري
- `delete_order_atomic()` - حذف طلب (soft delete) بشكل ذري
- `update_order_weight_atomic()` - تحديث وزن الطلب
- `recalculate_user_stats_atomic()` - إعادة حساب الإحصائيات
- `add_wallet_balance_atomic()` - إضافة رصيد للمحفظة

#### [`add_missing_columns.sql`](file:///c:/Huwiyya/shipping/Oshop/add_missing_columns.sql)
**الوصف**: إضافة أعمدة مفقودة وجدول audit log  
**يحتوي على**:
- إضافة حقل `deleted_at` للجداول
- إضافة حقل `walletBalance` للمستخدمين
- إنشاء جدول `audit_log`
- دالة `log_audit()` للتسجيل

#### [`create_indexes.sql`](file:///c:/Huwiyya/shipping/Oshop/create_indexes.sql)
**الوصف**: Indexes لتحسين الأداء  
**يحتوي على**: 40+ index على جميع الجداول الرئيسية

### 2. ملفات TypeScript

#### [`src/lib/validation.ts`](file:///c:/Huwiyya/shipping/Oshop/src/lib/validation.ts)
**الوصف**: Validation schemas باستخدام Zod  
**يحتوي على**: schemas للطلبات، المستخدمين، الخزينة، إلخ

#### [`src/lib/result-types.ts`](file:///c:/Huwiyya/shipping/Oshop/src/lib/result-types.ts)
**الوصف**: Result pattern للتعامل الموحد مع الأخطاء  
**يحتوي على**: `Result<T>`, `PaginatedResult<T>`, helper functions

#### [`src/lib/db-helpers.ts`](file:///c:/Huwiyya/shipping/Oshop/src/lib/db-helpers.ts)
**الوصف**: دوال مساعدة لعمليات قاعدة البيانات  
**يحتوي على**: `callStoredProcedure()`, `fetchPaginated()`, `logAudit()`, إلخ

#### [`src/lib/improved-actions.ts`](file:///c:/Huwiyya/shipping/Oshop/src/lib/improved-actions.ts)
**الوصف**: دوال محسّنة تستخدم الـ stored procedures  
**يحتوي على**: `addOrderAtomic()`, `deleteOrderAtomic()`, `updateOrderWeightAtomic()`, إلخ

---

## 🚀 خطوات التطبيق

### المرحلة 1: تطبيق ملفات SQL (⚠️ مطلوب)

يجب تطبيق ملفات SQL بالترتيب التالي:

```powershell
# 1. الاتصال بـ Supabase
# افتح Supabase Dashboard -> SQL Editor

# 2. تطبيق الملفات بالترتيب:
```

#### أ. تطبيق `add_missing_columns.sql`
```sql
-- انسخ محتوى الملف وألصقه في SQL Editor ثم RUN
```

#### ب. تطبيق `atomic_procedures.sql`
```sql
-- انسخ محتوى الملف وألصقه في SQL Editor ثم RUN
```

#### ج. تطبيق `create_indexes.sql`
```sql
-- انسخ محتوى الملف وألصقه في SQL Editor ثم RUN
```

> **ملاحظة**: يمكنك أيضاً تطبيق الملفات عبر CLI:
> ```bash
> psql -h db.xxx.supabase.co -U postgres -d postgres -f add_missing_columns.sql
> psql -h db.xxx.supabase.co -U postgres -d postgres -f atomic_procedures.sql
> psql -h db.xxx.supabase.co -U postgres -d postgres -f create_indexes.sql
> ```

---

### المرحلة 2: تحديث الكود

#### 1. تثبيت Zod (إذا لم يكن موجوداً)

```bash
npm install zod
```

#### 2. استبدال الدوال القديمة بالجديدة

في الملفات التي تستخدم `actions.ts`، قم بتحديث الـ imports:

```typescript
// ❌ القديم
import { 
  addOrder, 
  deleteOrder, 
  saveOrderWeight,
  getOrders,
  getUsers
} from '@/lib/actions';

// ✅ الجديد
import { 
  addOrderAtomic, 
  deleteOrderAtomic, 
  updateOrderWeightAtomic,
  getOrdersPaginated,
  getUsersPaginated
} from '@/lib/improved-actions';
```

#### 3. تحديث استدعاء الدوال

**مثال: إنشاء طلب**

```typescript
// ❌ القديم
const newOrder = await addOrder(orderData);
if (!newOrder) {
  // error handling
}

// ✅ الجديد
const result = await addOrderAtomic(orderData);
if (!result.success) {
  console.error(result.error);
  // error handling
} else {
  const newOrder = result.data;
  // success handling
}
```

**مثال: جلب الطلبات مع Pagination**

```typescript
// ❌ القديم
const orders = await getOrders(); // يجلب كل الطلبات!

// ✅ الجديد
const result = await getOrdersPaginated({ page: 1, limit: 50 });
const orders = result.data;
const pagination = result.pagination; // { total, hasNext, hasPrev, etc. }
```

---

### المرحلة 3: تحديث db-adapter.ts (اختياري)

في ملف [`src/lib/db-adapter.ts`](file:///c:/Huwiyya/shipping/Oshop/src/lib/db-adapter.ts)، يمكنك إزالة التعليق:

```typescript
// السطر 202 - يمكن حذف التعليق الآن
// Note: This is NOT ATOMIC... ❌ لم يعد صحيحاً!
```

---

## 📝 أمثلة الاستخدام

### مثال 1: إنشاء طلب جديد

```typescript
'use client';

import { addOrderAtomic } from '@/lib/improved-actions';
import { toast } from '@/components/ui/use-toast';

async function handleCreateOrder(formData: any) {
  const result = await addOrderAtomic({
    userId: formData.userId,
    customerName: formData.customerName,
    sellingPriceLYD: parseFloat(formData.price),
    downPaymentLYD: parseFloat(formData.downPayment || '0'),
    productLinks: formData.links,
    paymentMethod: formData.method
  });

  if (result.success) {
    toast({ title: "نجح!", description: "تم إنشاء الطلب بنجاح" });
    router.push(`/admin/orders/${result.data.id}`);
  } else {
    toast({ 
      title: "خطأ", 
      description: result.error, 
      variant: "destructive" 
    });
  }
}
```

### مثال 2: جلب الطلبات مع Pagination

```typescript
'use client';

import { useState, useEffect } from 'react';
import { getOrdersPaginated } from '@/lib/improved-actions';
import { PaginatedResult } from '@/lib/result-types';
import { Order } from '@/lib/types';

export default function OrdersPage() {
  const [result, setResult] = useState<PaginatedResult<Order>>();
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function fetchOrders() {
      const data = await getOrdersPaginated({ page, limit: 20 });
      setResult(data);
    }
    fetchOrders();
  }, [page]);

  if (!result) return <div>Loading...</div>;

  return (
    <div>
      {result.data.map(order => (
        <OrderCard key={order.id} order={order} />
      ))}
      
      <Pagination 
        current={result.pagination.page}
        total={result.pagination.totalPages}
        onPageChange={setPage}
        hasNext={result.pagination.hasNext}
        hasPrev={result.pagination.hasPrev}
      />
    </div>
  );
}
```

### مثال 3: استرجاع طلب محذوف

```typescript
import { restoreOrder } from '@/lib/improved-actions';

async function handleRestore(orderId: string) {
  const result = await restoreOrder(orderId);
  
  if (result.success) {
    toast({ title: "تم الاسترجاع بنجاح" });
  } else {
    toast({ title: "فشل الاسترجاع", description: result.error });
  }
}
```

---

## ✅ قائمة التحقق (Checklist)

- [ ] تطبيق `add_missing_columns.sql`
- [ ] تطبيق `atomic_procedures.sql`
- [ ] تطبيق `create_indexes.sql`
- [ ] تثبيت `zod`
- [ ] تحديث imports في الملفات
- [ ] تحديث استدعاء الدوال
- [ ] اختبار إنشاء طلب
- [ ] اختبار حذف طلب
- [ ] اختبار Pagination
- [ ] اختبار استرجاع طلب محذوف

---

## 🧪 الاختبار

قم بتشغيل هذه الاختبارات للتأكد من عمل كل شيء:

```typescript
// test صغير
async function testAtomicOrders() {
  console.log("🧪 Testing Atomic Operations...");

  // 1. إنشاء طلب
  const result = await addOrderAtomic({
    userId: 'test-user-id',
    customerName: 'Test Customer',
    sellingPriceLYD: 100,
    downPaymentLYD: 20,
    productLinks: 'test',
    paymentMethod: 'cash'
  });

  if (!result.success) {
    console.error("❌ Failed to create order:", result.error);
    return;
  }

  console.log("✅ Order created:", result.data.id);

  // 2. تحديث الوزن
  const weightResult = await updateOrderWeightAtomic(
    result.data.id,
    5, 50, 60, 'LYD', 'LYD'
  );

  if (weightResult.success) {
    console.log("✅ Weight updated. Cost diff:", weightResult.data.costDifference);
  }

  // 3. حذف الطلب
  const deleteResult = await deleteOrderAtomic(result.data.id);
  
  if (deleteResult.success) {
    console.log("✅ Order deleted. Refunded:", deleteResult.data.refundedAmount);
  }

  console.log("✅ All tests passed!");
}
```

---

## ⚠️ ملاحظات مهمة

1. **Backup قبل التطبيق**: تأكد من أخذ نسخة احتياطية من قاعدة البيانات قبل تطبيق ملفات SQL
2. **التطبيق التدريجي**: يمكنك تطبيق الإصلاحات تدريجياً بدلاً من دفعة واحدة
3. **الدوال القديمة**: الدوال القديمة في `actions.ts` ستبقى تعمل، لكن يُنصح بالانتقال للجديدة
4. **الأداء**: ستلاحظ تحسناً كبيراً في الأداء بعد تطبيق الـ Indexes

---

## 🎯 الملخص

الإصلاحات المُطبقة:
- ✅ معاملات ذرية باستخدام Stored Procedures
- ✅ Validation شامل باستخدام Zod
- ✅ Pagination لتحسين الأداء
- ✅ Soft Delete بدلاً من Hard Delete
- ✅ Audit Log لتتبع التغييرات
- ✅ Indexes لتسريع الاستعلامات
- ✅ Result pattern للتعامل الموحد مع الأخطاء
- ✅ Atomic operations لتجنب Race Conditions

النتيجة: نظام **أكثر أماناً، أسرع، وأسهل في الصيانة**! 🚀
