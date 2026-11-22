<?php

declare(strict_types=1);

/** Bell notifications and their email copy (WhatsApp texts are templates in WhatsAppTemplates). */
return [
    'mail' => [
        'brand' => 'مكسب',
        'brand_admin' => 'لوحة المنصة',
        'footer' => 'وصلتك الرسالة دي لأن إشعاراتك على الإيميل. تقدر تغيّرها لواتساب من «الإعدادات ← حسابي» في لوحة التحكم.',
        'open' => 'افتح لوحة التحكم',
    ],
    'money' => ':amount ج.م',

    'new_order' => [
        'title' => 'طلب جديد #:number',
        'body' => ':customer طلب بإجمالي :total.',
        'number' => 'رقم الطلب',
        'customer' => 'العميل',
        'total' => 'الإجمالي',
        'place' => 'المحافظة',
        'action' => 'افتح الطلب',
    ],
    'low_stock' => [
        'title' => 'المخزون قرّب يخلص: :product',
        'body' => 'فاضل :left قطعة بس من «:product».',
        'product' => 'المنتج',
        'left' => 'الباقي في المخزون',
        'action' => 'افتح المنتج',
    ],
    'plan_expiring' => [
        'title' => 'باقتك بتخلص بعد :days',
        'body' => 'باقة :plan هتخلص يوم :date. جدّدها عشان متجرك يفضل شغال من غير توقف.',
        'days' => '{1} يوم واحد|{2} يومين|[3,10] :count أيام|[11,*] :count يوم',
        'plan' => 'الباقة',
        'ends' => 'بتخلص يوم',
        'action' => 'جدّد الباقة',
    ],
    'plan_expired' => [
        'title' => 'باقتك خلصت',
        'body' => 'باقة متجرك خلصت، والمتجر هيقفل للزوار بعد فترة السماح. بياناتك كلها محفوظة، وأول ما تجدّد كل حاجة بترجع.',
        'action' => 'جدّد الباقة',
    ],
    'receipt_approved' => [
        'title' => 'تم قبول إيصال الدفع',
        'body' => 'إيصال الفاتورة :invoice اتقبل، والاشتراك اتفعّل.',
        'invoice' => 'الفاتورة',
        'amount' => 'المبلغ',
        'action' => 'افتح الفواتير',
    ],
    'receipt_rejected' => [
        'title' => 'إيصال الدفع اترفض',
        'body' => 'إيصال الفاتورة :invoice اترفض: :reason. تقدر ترفع إيصال جديد.',
        'invoice' => 'الفاتورة',
        'reason' => 'السبب',
        'action' => 'ارفع إيصال جديد',
    ],
    'support_reply' => [
        'title' => 'رد جديد من الدعم',
        'body' => 'فريق الدعم رد على محادثتك رقم :number.',
        'action' => 'افتح المحادثة',
    ],
    'domain_ready' => [
        'title' => 'الدومين بقى شغال',
        'body' => 'الدومين :host اتربط بمتجرك، والزوار يقدروا يفتحوه دلوقتي.',
        'action' => 'افتح الدومينات',
    ],
    'import_done' => [
        'title' => 'استيراد المنتجات خلص',
        'body' => 'اتضاف :created منتج واتحدّث :updated، و:failed صف فيه مشاكل.',
        'created' => 'منتجات جديدة',
        'updated' => 'منتجات اتحدّثت',
        'failed' => 'صفوف فيها مشاكل',
        'action' => 'افتح الاستيراد',
    ],
    'shipment_problem' => [
        'title' => 'شحنة الطلب #:number: :state',
        'body' => ':carrier: :state — :reason',
        'order' => 'الطلب',
        'tracking' => 'رقم التتبع',
        'state' => 'الحالة',
        'action' => 'افتح الطلب',
    ],
    'mailbox_failed' => [
        'title' => 'إيميل متجرك مش شغال',
        'body' => 'مقدرناش نبعت من إيميلك (:reason)، فالإيميلات بتطلع لعملائك من إيميل المنصة باسم متجرك لحد ما تصلّحه.',
        'action' => 'افتح إعدادات الإيميل',
    ],
    'shipment_failed' => [
        'title' => 'مقدرناش نشحن الطلب #:number مع :carrier',
    ],
    'ai_low_balance' => [
        'title' => 'رصيد الذكاء الاصطناعي قرّب يخلص',
        'body' => 'فاضل :left جنيه في رصيد الذكاء الاصطناعي. اشحن عشان تكمّل تستخدمه.',
        'left' => 'الرصيد',
        'action' => 'اشحن الرصيد',
    ],
];
