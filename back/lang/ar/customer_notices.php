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
    'payment_due' => [
        'subject' => 'طلبك رقم #:number من :store مستني الدفع',
        'intro' => 'شكرًا لطلبك! الطلب ده بيندفع مقدمًا: ادفع بالطريقة اللي اخترتها وارفع صورة الإيصال من الزرار تحت. لو مادفعتش خلال :days أيام الطلب بيتلغي.',
    ],
    'payment_confirmed' => [
        'subject' => 'وصلنا الدفع لطلبك رقم #:number',
        'intro' => ':store أكّد إن الدفع وصل، وطلبك اتأكد وبيتجهز دلوقتي.',
    ],
    'payment_rejected' => [
        'subject' => 'الإيصال بتاع طلبك رقم #:number محتاج يتراجع',
        'intro' => ':store مقدرش يأكد الإيصال: :reason. ارفع الإيصال الصح من الزرار تحت.',
    ],
    'payment_method' => 'طريقة الدفع',
    'pay' => 'ادفع وارفع الإيصال',
    'shipping_company' => 'شركة الشحن',
    'total' => 'الإجمالي',
    'tracking_number' => 'رقم الشحنة',
    'track' => 'تابع طلبك',
    'money' => ':amount ج.م',
    'footer' => 'وصلتك الرسالة دي لأنك طلبت من :store. تقدر تختار توصلك التحديثات على واتساب بدل الإيميل من حسابك في المتجر.',
];
