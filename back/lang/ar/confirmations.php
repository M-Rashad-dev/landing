<?php

declare(strict_types=1);

/** Order confirmation on WhatsApp: the replies to the customer and the notes on the order. */
return [
    'replies' => [
        'confirm' => 'شكرًا لحضرتك، وجاري تجهيز طلبك رقم :number من :store.',
        'cancel' => 'تم إلغاء طلبك رقم :number من :store.',
        'call' => 'تمام، حد من :store هيتواصل معاك قريب بخصوص طلبك رقم :number.',
        'already' => 'طلبك رقم :number من :store حالته دلوقتي: :status.',
    ],
    'confirmed_note' => 'اتأكد من العميل على واتساب',
    'cancelled_note' => 'اتلغى من العميل على واتساب',
    'timeout_note' => 'اتلغى لوحده: العميل ماردّش على رسالة التأكيد',
    'unavailable' => 'التأكيد على واتساب مش متاح دلوقتي.',
];
