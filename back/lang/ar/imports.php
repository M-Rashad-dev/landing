<?php

declare(strict_types=1);

return [
    // File problems (upload).
    'not_xlsx' => 'الملف ده مش ملف Excel سليم. افتحه في Excel واحفظه تاني بصيغة .xlsx.',
    'xls' => 'صيغة .xls القديمة مش مدعومة. افتح الملف في Excel واحفظه بصيغة .xlsx أو .csv.',
    'unreadable' => 'مقدرناش نقرا الملف.',
    'no_header' => 'مش لاقيين صف عناوين الأعمدة في أول الملف.',
    'no_rows' => 'الملف مفيهوش منتجات تحت صف العناوين.',
    'too_many_rows' => 'الملف فيه أكتر من :max صف. قسّمه على أكتر من ملف.',
    'busy' => 'فيه استيراد شغال دلوقتي. استنى لما يخلص أو وقّفه الأول.',
    'not_ready' => 'الاستيراد ده اتبدأ قبل كده.',
    'mapping_name' => 'اختار العمود اللي فيه اسم المنتج.',
    'mapping_price' => 'اختار العمود اللي فيه السعر.',
    'mapping_match' => 'عشان نحدّث المنتجات الموجودة، اختار عمود الـ SKU.',
    'mapping_column' => 'العمود ده مش موجود في الملف.',
    'mapping_twice' => 'العمود ده متحدد لأكتر من حاجة.',

    // Why a product failed.
    'name_missing' => 'اسم المنتج فاضي',
    'price_missing' => 'السعر فاضي',
    'price_invalid' => 'السعر «:value» مش رقم',
    'price_zero' => 'السعر لازم يكون أكبر من صفر',
    'price_high' => 'السعر أكبر من المسموح',
    'stock_invalid' => 'الكمية «:value» مش رقم صحيح',
    'duplicate_sku' => 'الـ SKU «:sku» متكرر في الملف (أول مرة في صف :row)',
    'exists' => 'فيه منتج بنفس الـ SKU «:sku» واخترت تسيب الموجود',
    'too_many_values' => 'الخيار «:option» فيه أكتر من :max قيمة',
    'save_failed' => 'حصلت مشكلة وإحنا بنحفظ المنتج',
    'option' => 'خيار :n',

    // Notes on the whole import.
    'prices_rounded' => 'بعض المنتجات ليها أسعار مختلفة لكل تركيبة خيارات: حطينا فرق السعر على كل قيمة، راجع أسعارها.',
    'categories_skipped' => 'التصنيفات اتجاهلت لأن باقتك من غير متجر.',
    'category_failed' => 'التصنيف «:name» ما اتعملش: :reason',
    'names_cut' => 'بعض الأسماء أو الأوصاف كانت أطول من المسموح واتقصّت.',
    'images_skipped' => 'بعض المنتجات فيها أكتر من 10 صور: أخدنا أول 10.',
    'image_failed' => 'صورة ما اتحملتش',

    // Files we give back.
    'template_name' => 'قالب-استيراد-المنتجات',
    'failures_name' => 'المنتجات-اللي-فشلت',
    'failures_sheet' => 'فشلت',
    'reason_column' => 'سبب الفشل',
    'row_column' => 'رقم الصف',
];
