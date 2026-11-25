<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\PaymentMethod;
use Illuminate\Database\Seeder;

/**
 * The ways merchants pay the platform. Manual ones start off and without an account: the platform owner fills the
 * InstaPay address / wallet number in the admin and turns them on. Online (XPay) starts off too and shows only while its
 * keys are set. Safe on every deploy (insertOrIgnore: the admin's edits stay).
 */
class PaymentMethodSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        PaymentMethod::query()->insertOrIgnore([
            [
                'key' => 'instapay', 'name' => 'إنستاباي', 'kind' => 'manual', 'account_label' => 'عنوان الدفع (IPA)',
                'account_value' => null, 'instructions' => 'حوّل المبلغ من تطبيق إنستاباي لعنوان الدفع ده، واكتب رقم الفاتورة في الملاحظات، وبعدها ارفع صورة إيصال التحويل.',
                'is_active' => false, 'sort_order' => 1, 'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'key' => 'vodafone_cash', 'name' => 'فودافون كاش ومحافظ الموبايل', 'kind' => 'manual', 'account_label' => 'رقم المحفظة',
                'account_value' => null, 'instructions' => 'حوّل المبلغ من أي محفظة (فودافون كاش، اتصالات كاش، أورنج كاش، WE Pay) للرقم ده، وبعدها ارفع صورة رسالة التحويل.',
                'is_active' => false, 'sort_order' => 2, 'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'key' => 'xpay', 'name' => 'ادفع أونلاين (كارت، محفظة، فوري، valU)', 'kind' => 'xpay', 'account_label' => null,
                'account_value' => null, 'instructions' => 'هتتحوّل لصفحة دفع آمنة من X-Pay، وأول ما الدفع يتم الفاتورة بتتفعّل لوحدها.',
                'is_active' => false, 'sort_order' => 0, 'created_at' => $now, 'updated_at' => $now,
            ],
        ]);
    }
}
