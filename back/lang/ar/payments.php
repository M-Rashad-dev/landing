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
    'online' => [
        'unavailable' => 'الدفع الأونلاين مش متاح دلوقتي. جرّب كمان شوية أو ادفع بالتحويل وارفع الإيصال.',
        'plan' => 'اشتراك مكسب: باقة :name',
        'theme' => 'ثيم :name من مكسب',
        'ai_credit' => 'رصيد الذكاء الاصطناعي في مكسب',
        'message_pack' => ':count رسالة واتساب لتذكير السلات',
    ],
];
