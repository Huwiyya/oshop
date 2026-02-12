# تطبيق Treasury Atomic Functions

## الطريقة الموصى بها (يدوياً - 2 دقيقة)

### الخطوات:
1. افتح **Supabase Dashboard** في المتصفح
2. اذهب إلى **SQL Editor** من القائمة الجانبية
3. اضغط **+ New Query**
4. انسخ **كل** محتوى الملف [`treasury_atomic_functions.sql`](file:///Users/zaki/Downloads/Oshop-main/src/lib/treasury_atomic_functions.sql)
5. الصق في SQL Editor
6. اضغط **Run** (أو Ctrl+Enter)
7. انتظر رسالة "Success" ✅

### ما سيتم إنشاؤه:
- ✅ `create_receipt_atomic()` - إنشاء سند قبض + قيد يومي
- ✅ `create_payment_atomic()` - إنشاء سند صرف + قيد يومي
- ✅ `delete_receipt_atomic()` - حذف سند قبض + قيده
- ✅ `delete_payment_atomic()` - حذف سند صرف + قيده

### بعد التطبيق:
أخبرني وسأقوم بـ:
1. اختبار إنشاء سند قبض جديد
2. اختبار إنشاء سند صرف جديد  
3. التحقق من ظهورهم في القيود اليومية
4. التحقق من تحديث الملخص المالي

---

## لماذا لا يمكن التطبيق التلقائي؟

Supabase لا يوفر واجهة API مباشرة لتنفيذ SQL عبر REST API بدون:
- كلمة مرور PostgreSQL الفعلية (`postgres` user password)
- أو أداة command-line مثل `psql`

Service Role Key المقدم يسمح بعمليات CRUD لكن ليس تنفيذ SQL مباشر.
