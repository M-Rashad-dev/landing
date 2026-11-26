<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Merchants no longer write a reference in the transfer note: the default InstaPay text stops asking for it
 * (only when the admin never changed it).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('payment_methods')->where('key', 'instapay')->where('instructions', 'حوّل المبلغ من تطبيق إنستاباي لعنوان الدفع ده، واكتب رقم الفاتورة في الملاحظات، وبعدها ارفع صورة إيصال التحويل.')
            ->update(['instructions' => 'حوّل المبلغ من تطبيق إنستاباي لعنوان الدفع ده، وبعدها ارفع صورة إيصال التحويل.', 'updated_at' => now()]);
    }

    public function down(): void
    {
        // Text only; nothing to undo.
    }
};
