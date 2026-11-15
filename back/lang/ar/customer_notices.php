<?php

declare(strict_types=1);

/** Order emails to a store's customers (the WhatsApp texts are templates in WhatsAppTemplates). */
return [
    'received' => [
        'subject' => 'تم استلام طلبك رقم #:number من :store',
        'intro' => 'شكرًا لطلبك! المتجر هيتواصل معاك لتأكيد الطلب قبل الشحن.',
    ],
    'shipped' => [
        'subject' => 'طلبك رقم #:number اتشحن',
        'intro' => 'طلبك خرج للشحن مع :company، وهيوصلك قريب.',
    ],
    'cancelled' => [
        'subject' => 'تم إلغاء طلبك رقم #:number',
        'intro' => 'طلبك من :store اتلغى. لو ده حصل بالغلط، تواصل مع المتجر.',
    ],
    'delivered' => [
        'subject' => 'طلبك رقم #:number اتسلّم',
        'intro' => 'نتمنى الطلب يكون عجبك. شكرًا لثقتك في :store.',
    ],
    'shipping_company' => 'شركة الشحن',
    'total' => 'الإجمالي',
    'tracking_number' => 'رقم الشحنة',
    'track' => 'تابع طلبك',
    'money' => ':amount ج.م',
    'footer' => 'وصلتك الرسالة دي لأنك طلبت من :store. تقدر تختار توصلك التحديثات على واتساب بدل الإيميل من حسابك في المتجر.',
];
