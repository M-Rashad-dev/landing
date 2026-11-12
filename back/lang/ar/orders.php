<?php

declare(strict_types=1);

return [
    'rejected' => 'تعذر إتمام الطلب. حاول مرة أخرى لاحقًا.',
    'product_unavailable' => 'المنتج غير متاح حاليًا.',
    'form_unavailable' => 'نموذج الطلب غير متاح في هذه الصفحة.',
    'field_not_allowed' => 'هذا الحقل غير متاح في نموذج الطلب.',
    'invalid_phone' => 'رقم الموبايل غير صحيح.',
    'invalid_ip' => 'عنوان IP غير صحيح.',
    'fields' => [
        'name' => 'الاسم',
        'phone' => 'رقم الموبايل',
        'phone2' => 'رقم موبايل آخر',
        'governorate' => 'المحافظة',
        'city' => 'المدينة / المنطقة',
        'address' => 'العنوان',
        'notes' => 'الملاحظات',
    ],
    'transition_not_allowed' => 'لا يمكن تغيير حالة الطلب من «:from» إلى «:to».',
    'edit_not_allowed' => 'لا يمكن تعديل بيانات العميل بعد أن أصبحت حالة الطلب «:status».',
    'already_blocked' => 'هذه القيمة محظورة بالفعل.',
    'blocked_from_order' => 'محظور من الطلب #:number',
    'export_too_large' => 'عدد الطلبات أكبر من :max. ضيّق الفلاتر ثم صدّر مرة أخرى.',
    'not_found' => 'الطلب غير موجود.',
    'contact_closed' => 'متابعة التأكيد للطلبات الجديدة فقط.',
    'follow_up_range' => 'اختر وقتًا في المستقبل خلال 30 يومًا.',
    'track_not_found' => 'لم نجد طلبًا بهذا الرقم ورقم الموبايل. راجع البيانات وحاول مرة أخرى.',
    'shipping_unavailable' => 'التوصيل غير متاح لهذه المحافظة حاليًا.',
    'shipping_company_unavailable' => 'شركة الشحن دي مش بتوصل للمحافظة دي، اختار شركة تانية.',
    'upsell_closed' => 'العرض ده مبقاش متاح.',
    'upsell_product_options' => 'اختار منتج مالوش اختيارات إجبارية (المقاس أو اللون)، لأن العرض بيتضاف بضغطة واحدة.',
    'upsell_same_product' => 'المنتج المعروض لازم يكون مختلف عن منتج الطلب.',
    'auto_block_per_day' => 'حظر تلقائي: :count طلبات في يوم واحد.',
    'auto_block_same_in_row' => 'حظر تلقائي: نفس الطلب :count مرات ورا بعض.',
    'auto_block_returns' => 'حظر تلقائي: :returned طلبات مرتجعة من :total.',
];
