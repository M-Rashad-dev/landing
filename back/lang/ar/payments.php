<?php

declare(strict_types=1);

return [
    'choose' => 'اختار طريقة الدفع.',
    'unavailable' => 'طريقة الدفع دي مش متاحة دلوقتي. اختار طريقة تانية.',
    'receipt_type' => 'الإيصال لازم يكون صورة (JPG أو PNG أو WEBP) أو PDF.',
    'receipt_size' => 'الإيصال أكبر من :max ميجا.',
    'not_awaiting' => 'الطلب ده مش مستني دفع.',
    'receipt_pending' => 'فيه إيصال لسه بيتراجع. استنى رد المتجر.',
    'already_reviewed' => 'الإيصال ده اتراجع قبل كده.',
    'confirmed_note' => 'الدفع وصل (:method)',
    'auto_cancel_note' => 'اتلغى لوحده: مادفعش في المدة المحددة',
    'method_used' => 'طريقة الدفع دي عليها طلبات مستنية الدفع. وقّفها بدل ما تمسحها.',
    'link_https' => 'اللينك لازم يبدأ بـ https://',
    'account_required' => 'اكتب الرقم أو الحساب اللي العميل هيحوّل عليه.',
    'link_required' => 'حط لينك الدفع.',

    // The platform's own invoices (subscriptions, themes, AI balance, message packs).
    'receipt_invalid' => 'الإيصال لازم يكون صورة (JPG أو PNG أو WebP).',
    'receipt_too_large' => 'حجم صورة الإيصال أكبر من :max ميجا.',
    'method_unavailable' => 'وسيلة الدفع دي مش متاحة حاليًا.',
    'invoice_not_open' => 'الفاتورة دي مش مستنية دفع (اتدفعت أو اتلغت أو انتهت). اعمل فاتورة جديدة من صفحة الباقات.',
    'invoice_pending_review' => 'عندك إيصال لسه بيتراجع. استنى قرار الإدارة الأول.',
    'refund_not_allowed' => 'الاسترجاع متاح خلال 3 أيام من بداية الاشتراك المدفوع، ومرة واحدة كل 6 شهور.',
    'refund_not_requested' => 'مفيش طلب استرجاع على الفاتورة دي.',
    // Online payment in the stores with the merchant's own gateway account.
    'gateways' => [
        'not_found' => 'بوابة الدفع دي مش موجودة.',
        'unreachable' => 'مقدرناش نوصل لـ :gateway دلوقتي. جرّب كمان شوية.',
        'auth' => 'بيانات :gateway مش صح. راجعها من لوحة :gateway وجرّب تاني.',
        'refused' => ':gateway رفض الطلب. راجع إعدادات حسابك هناك أو كلّم دعمهم.',
        'checkout_failed' => 'الدفع الأونلاين مش متاح دلوقتي. جرّب كمان شوية أو اختار طريقة دفع تانية.',
        'in_use' => 'فيه طلبات لسه مستنية الدفع بالبوابة دي. استنى لما تتدفع أو تتلغي، وبعدها افصلها.',
        'manage_there' => 'طريقة الدفع دي تابعة لبوابة الدفع المربوطة: غيّرها من قسم «الدفع الأونلاين».',
        'method_name' => 'ادفع أونلاين (كارت أو محفظة)',
        'method_hint' => 'هتتحوّل لصفحة دفع آمنة من :gateway، وأول ما الدفع يتم طلبك بيتأكد لوحده.',
        'item' => 'طلب رقم :number من :store',
        'paid_note' => 'اتدفع أونلاين (:gateway)',
        'paymob' => [
            'keys' => 'المفتاح السري لازم يبدأ بـ sk_test_ أو sk_live_، والعام بـ pk_test_ أو pk_live_، والاتنين من نفس الوضع (تجربة أو حقيقي).',
            'integrations' => 'اكتب رقم Integration ID واحد على الأقل (الكارت، المحفظة…) مفصولين بفاصلة.',
            'fields' => [
                'secret_key' => ['label' => 'Secret Key', 'hint' => 'من لوحة Paymob: Settings ← API Keys ← View جنب Secret key (بيبدأ بـ sk_).'],
                'public_key' => ['label' => 'Public Key', 'hint' => 'من نفس الصفحة: Public key (بيبدأ بـ pk_).'],
                'api_key' => ['label' => 'API Key', 'hint' => 'من نفس الصفحة: API key.'],
                'hmac_secret' => ['label' => 'HMAC Secret', 'hint' => 'من Settings ← Account Info (أو API Keys): HMAC.'],
                'integration_ids' => ['label' => 'Integration IDs', 'hint' => 'من Settings ← Payment Integrations: رقم الكارت ورقم المحفظة… مفصولين بفاصلة (مثلًا 4900123, 4900124).'],
            ],
        ],
        'kashier' => [
            'keys' => 'اكتب الـ MID (شكله MID-xx-xxx) والـ Payment API Key والـ Secret Key من لوحة Kashier.',
            'fields' => [
                'merchant_id' => ['label' => 'MID', 'hint' => 'تحت اسمك فوق في لوحة Kashier (شكله MID-xx-xxx).'],
                'api_key' => ['label' => 'Payment API Key', 'hint' => 'من Integrations ← API Keys.'],
                'secret_key' => ['label' => 'Secret Key', 'hint' => 'من Integrations ← Secret Keys (بيبدأ بـ ksk_). بيظهر مرة واحدة وقت ما تعمله.'],
            ],
        ],
        'xpay' => [
            'keys' => 'المفتاح السري لازم يبدأ بـ sk_test_ أو sk_live_.',
            'fields' => [
                'secret_key' => ['label' => 'المفتاح السري', 'hint' => 'من لوحة X-Pay: منصة المطورين ← مفاتيح API ← المفتاح السري (بيبدأ بـ sk_). لينك الإشعارات بيتسجّل لوحده.'],
            ],
        ],
    ],
    'online' => [
        'unavailable' => 'الدفع الأونلاين مش متاح دلوقتي. جرّب كمان شوية أو ادفع بالتحويل وارفع الإيصال.',
        'plan' => 'اشتراك مكسب: باقة :name',
        'theme' => 'ثيم :name من مكسب',
        'ai_credit' => 'رصيد الذكاء الاصطناعي في مكسب',
        'message_pack' => ':count رسالة واتساب لتذكير السلات',
    ],
];
