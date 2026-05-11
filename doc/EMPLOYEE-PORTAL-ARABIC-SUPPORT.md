# بورتال الموظفين - دعم اللغة العربية

## نظرة عامة
تم إضافة دعم ثنائي اللغة (العربية والإنجليزية) إلى بوابة الموظفين. يمكن للمستخدمين التبديل بين اللغتين بسهولة.

## الميزات

### 1. تبديل اللغة
- **زر تبديل اللغة**: يوجد في الشريط الجانبي وفي الرأس
- **الحفظ التلقائي**: يتم حفظ تفضيل اللغة في localStorage
- **RTL Support**: عند التفعيل بالعربية، يتغير الاتجاه من اليسار لليمين إلى اليمين لليسار

### 2. النصوص المترجمة
جميع النصوص في البوابة مترجمة:
- قائمة التنقل الجانبية
- حالة الوكيل
- البطاقات والإحصائيات
- رسائل الحالة الفارغة

## كيفية الاستخدام

### التبديل إلى العربية
1. انقر على زر اللغة ( Languages ) في الشريط الجانبي أو الرأس
2. سيتحول الواجهة إلى العربية مع اتجاه RTL

### التبديل إلى الإنجليزية
1. انقر على نفس الزر
2. سيعود الواجهة إلى الإنجليزية مع اتجاه LTR

## الملفات المعدلة

### جديد
- `ui/src/lib/translations.ts` - نظام الترجمة
- `ui/src/components/EmployeeLayout.tsx` - دعم اللغة

## المفاتيح المتاحة للترجمة

```typescript
// الإنجليزية
{
  portalTitle: "EMPLOYEE PORTAL",
  portfolioDashboard: "Portfolio Dashboard",
  agentStudio: "Agent Studio",
  realtimeKanban: "Realtime Kanban",
  mailboxApprovals: "Mailbox & Approvals",
  // ...more
}

// العربية
{
  portalTitle: "بوابة الموظفين",
  portfolioDashboard: "لوحة المحافظ",
  agentStudio: "استوديو الوكيل",
  realtimeKanban: "كانبان في الوقت الفعلي",
  mailboxApprovals: "البريد والموافقات",
  // ...more
}
```

## إضافة ترجمات جديدة

لإضافة ترجمة جديدة:

1. أضف المفتاح في `translations.ts`:
```typescript
en: {
  newKey: "English text",
},
ar: {
  newKey: "النص العربي",
}
```

2. استخدمه في المكون:
```typescript
const { t } = useTranslations();
<span>{t("newKey")}</span>
```

## دعم RTL

عند التبديل للعربية:
- `document.documentElement.dir = "rtl"`
- `document.documentElement.lang = "ar"`
- التخطيط يتكيف تلقائياً

## اختبار

```bash
http://localhost:3100/employee-portal/:agentId/dashboard
```

انقر على زر اللغة للتحقق من:
- ✓ تبديل النصوص
- ✓ تغيير الاتجاه
- ✓ حفظ التفضيل
