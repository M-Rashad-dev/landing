<?php

declare(strict_types=1);

/** WhatsApp messages the platform writes itself (templates live in App\Messaging\WhatsApp\WhatsAppTemplates). */
return [
    'admin' => [
        'not_configured' => 'واتساب مش متوصّل: حط مفاتيح WHATSAPP_* في ملف .env على السيرفر.',
        'meta_error' => 'Meta رفضت الطلب: :error',
    ],
    'auto_reply' => [
        'store' => "أهلًا 👋\nالرقم ده بيبعت إشعارات وأكواد بس، ومحدش بيقرا الرسايل اللي بتوصله.\nللتواصل مع :store ادخل على موقع المتجر: :url",
        'generic' => "أهلًا 👋\nالرقم ده بيبعت إشعارات وأكواد بس، ومحدش بيقرا الرسايل اللي بتوصله.\nللتواصل مع المتجر ارجع لموقعه.",
    ],
];
