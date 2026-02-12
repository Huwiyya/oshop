# 🚀 دليل تطبيق الإصلاحات الحرجة

## المتطلبات الأساسية

- قاعدة بيانات PostgreSQL
- صلاحيات تنفيذ SQL
- نسخة احتياطية من قاعدة البيانات الحالية (**مهم جداً!**)

---

## 📋 الخطوات

### 1. النسخ الاحتياطي ⚠️

**قبل أي شيء**، خذ نسخة احتياطية:

```bash
# استبدل DATABASE_URL برابط قاعدة بياناتك
pg_dump "YOUR_DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. تطبيق الإصلاحات الحرجة

#### أ) إذا كنت تستخدم Supabase:

1. افتح [Supabase Dashboard](https://app.supabase.com)
2. اذهب إلى **SQL Editor**
3. افتح ملف `src/lib/apply-critical-fixes.sql`
4. انسخ المحتوى والصقه في SQL Editor
5. اضغط **Run**

#### ب) إذا كنت تستخدم PostgreSQL محلي:

```bash
cd /Users/zaki/Downloads/Oshop-main

# استبدل DATABASE_URL برابط قاعدة بياناتك
psql "YOUR_DATABASE_URL" -f src/lib/apply-critical-fixes.sql
```

مثال:
```bash
psql "postgresql://user:password@localhost:5432/oshop_db" -f src/lib/apply-critical-fixes.sql
```

### 3. التحقق من النجاح ✅

بعد تنفيذ السكريبت، يجب أن ترى:

```
====================================
CRITICAL FIXES APPLIED SUCCESSFULLY
====================================

✓ System Accounts Table: 6 mappings created
✓ Fiscal Periods: 12 periods created
✓ Tax Rates: 2 rates configured
✓ Tax columns added to sales_invoices
✓ Tax columns added to purchase_invoices
✓ Helper functions created
✓ Triggers activated
```

### 4. التحقق اليدوي (اختياري)

```sql
-- 1. تحقق من system_accounts
SELECT * FROM system_accounts;

-- 2. تحقق من fiscal_periods
SELECT period_name, start_date, end_date, is_closed 
FROM fiscal_periods 
ORDER BY start_date;

-- 3. تحقق من tax_rates
SELECT name_ar, rate, is_default FROM tax_rates;

-- 4. تحقق من الأعمدة الجديدة
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'sales_invoices' 
AND column_name IN ('tax_rate', 'discount_percentage', 'discount_amount');
```

---

## 🧪 اختبار الميزات

### 1. اختبار Period Locking

```sql
-- أغلق فترة يناير
UPDATE fiscal_periods 
SET is_closed = TRUE 
WHERE period_name LIKE 'January%';

-- حاول إضافة قيد في يناير (يجب أن يفشل)
INSERT INTO journal_entries (entry_number, entry_date, description)
VALUES ('TEST-001', '2026-01-15', 'Test Entry');
-- ❌ يجب أن تظهر: "لا يمكن إضافة قيد محاسبي في فترة مغلقة"

-- إعادة فتح الفترة
UPDATE fiscal_periods SET is_closed = FALSE WHERE period_name LIKE 'January%';
```

### 2. اختبار Tax Calculation

```sql
-- احسب فاتورة بقيمة 1000 مع خصم 10% وضريبة 14%
SELECT * FROM calculate_invoice_total(1000, 10, 14);

-- النتيجة المتوقعة:
-- subtotal: 1000
-- discount: 100
-- after_discount: 900
-- tax: 126
-- total: 1026
```

### 3. اختبار System Accounts

```sql
-- اجلب حساب العملاء
SELECT get_system_account('CUSTOMERS_CONTROL');

-- حاول حذف system account (يجب أن يفشل)
DELETE FROM system_accounts WHERE key = 'CUSTOMERS_CONTROL';
-- ❌ يجب أن تظهر: "Cannot modify or delete locked system account"
```

---

## 🔧 استكشاف الأخطاء

### خطأ: "relation already exists"

```sql
-- إذا كانت الجداول موجودة مسبقاً، احذفها أولاً:
DROP TABLE IF EXISTS system_accounts CASCADE;
DROP TABLE IF EXISTS fiscal_periods CASCADE;
DROP TABLE IF EXISTS tax_rates CASCADE;

-- ثم أعد تشغيل السكريبت
```

### خطأ: "account with code 1120 not found"

```sql
-- تأكد من وجود Chart of Accounts الأساسي
SELECT account_code, name_ar FROM accounts 
WHERE account_code IN ('1120', '2110', '2130', '113001', '410001', '510001');

-- إذا لم تكن موجودة، نفذ:
psql -f src/lib/recreate_accounting_schema.sql
```

### خطأ: "column already exists"

هذا طبيعي - السكريبت يستخدم `IF NOT EXISTS` و `ADD COLUMN IF NOT EXISTS`.

---

## 📝 ملاحظات مهمة

1. **النسخ الاحتياطي**: لا تطبق السكريبت بدون نسخة احتياطية.
2. **الترتيب**: لا تغير ترتيب الأجزاء في السكريبت.
3. **الإنتاج**: اختبر على قاعدة بيانات تجريبية أولاً.
4. **الأداء**: قد يستغرق السكريبت 1-2 دقيقة على قواعد بيانات كبيرة.

---

## 📞 الدعم

إذا واجهت مشاكل:
1. تحقق من logs قاعدة البيانات
2. تأكد من الصلاحيات
3. راجع الأجزاء التي فشلت وشغلها منفصلة

---

## ✅ بعد التطبيق

الميزات الجديدة المتاحة:
- ✅ System Accounts (أكواد حسابات ديناميكية)
- ✅ Fiscal Period Locking (حماية الفترات)
- ✅ Tax Support (ضرائب وخصومات)
- ✅ Financial Reports Functions (تقارير مالية)

**الخطوة التالية**: تحديث واجهة المستخدم لاستخدام الميزات الجديدة.
