<?php

declare(strict_types=1);

namespace App\Messaging\WhatsApp;

/**
 * The WhatsApp templates the platform uses, in Meta's format. `php artisan whatsapp:templates push`
 * submits the missing ones for review. Meta re-reviews a template on every edit (and it can't be
 * sent meanwhile), so a wording change is a NEW name (…_v2): push it, and switch here once approved.
 *
 * Button links must have a fixed domain in the template: store links go through the platform
 * domain (/t/{token} → that store's tracking page), dashboard links through the app host.
 */
final class WhatsAppTemplates
{
    public const LANGUAGE = 'ar';

    /** Sign-in codes (customers, merchants): Meta writes the text; we choose expiry and the copy button. */
    public const CODE = 'mksab_code_v1';

    /** Minutes shown under the code (matches CustomerAccounts::CODE_TTL). */
    public const CODE_MINUTES = 5;

    /**
     * Utility templates: key => [name, body with {{n}}, example values, optional URL button].
     *
     * @var array<string, array{name: string, body: string, examples: list<string>, button?: array{text: string, host: 'platform'|'app', path: string, example: string}}>
     */
    private const UTILITY = [
        'order_received' => [
            'name' => 'order_received_v1',
            'body' => "تم استلام طلبك رقم {{1}} من {{2}} بإجمالي {{3}} جنيه.\nالمتجر هيتواصل معاك لتأكيد الطلب قبل الشحن.",
            'examples' => ['1024', 'متجر حبة', '450'],
            'button' => ['text' => 'تابع طلبك', 'host' => 'platform', 'path' => 't/{{1}}', 'example' => 'k3x9q2'],
        ],
        'order_shipped' => [
            'name' => 'order_shipped_v1',
            'body' => "طلبك رقم {{1}} من {{2}} خرج للشحن مع {{3}}.\nتقدر تتابع حالته من الزرار تحت.",
            'examples' => ['1024', 'متجر حبة', 'بوسطة'],
            'button' => ['text' => 'تابع طلبك', 'host' => 'platform', 'path' => 't/{{1}}', 'example' => 'k3x9q2'],
        ],
        'order_cancelled' => [
            'name' => 'order_cancelled_v1',
            'body' => "تم إلغاء طلبك رقم {{1}} من {{2}}.\nلو ده حصل بالغلط، تواصل مع المتجر.",
            'examples' => ['1024', 'متجر حبة'],
        ],
        'order_delivered' => [
            'name' => 'order_delivered_v1',
            'body' => 'طلبك رقم {{1}} من {{2}} اتسلّم. شكرًا لثقتك.',
            'examples' => ['1024', 'متجر حبة'],
        ],
        'merchant_new_order' => [
            'name' => 'merchant_new_order_v1',
            'body' => 'طلب جديد رقم {{1}} في متجر {{2}} بإجمالي {{3}} جنيه.',
            'examples' => ['1024', 'متجر حبة', '450'],
            'button' => ['text' => 'افتح الطلب', 'host' => 'app', 'path' => 'dashboard/orders/{{1}}', 'example' => '381'],
        ],
        'plan_expiring' => [
            'name' => 'plan_expiring_v1',
            'body' => "باقة {{1}} لمتجر {{2}} هتنتهي يوم {{3}}.\nجدّدها من صفحة الباقة عشان متجرك يفضل شغال.",
            'examples' => ['برو', 'متجر حبة', '20 نوفمبر'],
        ],
        'plan_expired' => [
            'name' => 'plan_expired_v1',
            'body' => "باقة متجر {{1}} انتهت، والمتجر هيقفل للزوار بعد فترة السماح.\nجدّد من لوحة التحكم، وبياناتك كلها محفوظة.",
            'examples' => ['متجر حبة'],
        ],
        'receipt_approved' => [
            'name' => 'receipt_approved_v1',
            'body' => 'تم قبول إيصال الدفع للفاتورة رقم {{1}}. شكرًا لك.',
            'examples' => ['INV-1042'],
        ],
        'receipt_rejected' => [
            'name' => 'receipt_rejected_v1',
            'body' => "إيصال الدفع للفاتورة رقم {{1}} اترفض، والسبب: {{2}}.\nتقدر ترفع إيصال جديد من لوحة التحكم.",
            'examples' => ['INV-1042', 'المبلغ ناقص'],
        ],
        'merchant_low_stock' => [
            'name' => 'merchant_low_stock_v1',
            'body' => 'المنتج {{1}} في متجر {{2}} فاضل منه {{3}} قطعة بس في المخزون.',
            'examples' => ['بن برازيلي 250 جم', 'متجر حبة', '3'],
        ],
        'merchant_support_reply' => [
            'name' => 'merchant_support_reply_v1',
            'body' => 'فيه رد جديد من فريق الدعم على محادثتك رقم {{1}}. تقدر تشوفه من لوحة التحكم.',
            'examples' => ['1042'],
        ],
        'merchant_domain_ready' => [
            'name' => 'merchant_domain_ready_v1',
            'body' => 'الدومين {{1}} اتربط بمتجر {{2}} وبقى شغال.',
            'examples' => ['habba-shop.com', 'متجر حبة'],
        ],
        'merchant_import_done' => [
            'name' => 'merchant_import_done_v1',
            'body' => 'استيراد المنتجات لمتجر {{1}} خلص: اتضاف أو اتحدّث {{2}} منتج، و{{3}} صف فيه مشاكل.',
            'examples' => ['متجر حبة', '120', '4'],
        ],
        // v1 was put under Marketing by Meta: v2 reads as a plain account update.
        'admin_new_receipt' => [
            'name' => 'admin_new_receipt_v2',
            'body' => 'تم استلام إيصال دفع من متجر {{1}} بمبلغ {{2}} جنيه، وهو مستني مراجعتك في لوحة الإدارة.',
            'examples' => ['متجر حبة', '1200'],
        ],
        'admin_refund_request' => [
            'name' => 'admin_refund_request_v1',
            'body' => 'متجر {{1}} طلب استرداد مبلغ {{2}} جنيه للفاتورة رقم {{3}}، والطلب مستني مراجعتك.',
            'examples' => ['متجر حبة', '100', 'INV-1042'],
        ],
        'admin_new_store' => [
            'name' => 'admin_new_store_v1',
            'body' => 'تم تسجيل متجر جديد باسم {{1}}، وصاحبه {{2}}، ورقم موبايله {{3}}.',
            'examples' => ['متجر حبة', 'أحمد علي', '01012345678'],
        ],
        'admin_support_ticket' => [
            'name' => 'admin_support_ticket_v1',
            'body' => 'محادثة دعم جديدة رقم {{1}} من متجر {{2}} عن {{3}}، ومستنية ردك.',
            'examples' => ['1042', 'متجر حبة', 'الدفع والاشتراك'],
        ],
        'admin_daily_summary' => [
            'name' => 'admin_daily_summary_v1',
            'body' => 'ملخص يوم {{1}} على المنصة: {{2}} متجر جديد، و{{3}} طلب، و{{4}} إيصال مستني مراجعة.',
            'examples' => ['2026-11-15', '3', '57', '2'],
        ],
    ];

    /** @return list<string> every template name the platform needs */
    public static function names(): array
    {
        return [self::CODE, ...array_values(array_map(fn (array $t): string => $t['name'], self::UTILITY))];
    }

    /** Meta's name for a utility template key. */
    public static function name(string $key): string
    {
        return self::UTILITY[$key]['name'] ?? throw new \InvalidArgumentException("Unknown WhatsApp template {$key}");
    }

    /**
     * What to submit to Meta for each template.
     *
     * @return list<array<string, mixed>>
     */
    public static function definitions(): array
    {
        $definitions = [[
            'name' => self::CODE,
            'language' => self::LANGUAGE,
            'category' => 'AUTHENTICATION',
            'components' => [
                ['type' => 'BODY', 'add_security_recommendation' => true],
                ['type' => 'FOOTER', 'code_expiration_minutes' => self::CODE_MINUTES],
                // No custom text: Meta refuses it on this button and shows its own («نسخ الرمز»).
                ['type' => 'BUTTONS', 'buttons' => [['type' => 'OTP', 'otp_type' => 'COPY_CODE']]],
            ],
        ]];

        foreach (self::UTILITY as $template) {
            $components = [['type' => 'BODY', 'text' => $template['body'], 'example' => ['body_text' => [$template['examples']]]]];
            if (isset($template['button'])) {
                $base = self::base($template['button']['host']);
                $components[] = ['type' => 'BUTTONS', 'buttons' => [[
                    'type' => 'URL',
                    'text' => $template['button']['text'],
                    'url' => $base.$template['button']['path'],
                    'example' => [$base.str_replace('{{1}}', $template['button']['example'], $template['button']['path'])],
                ]]];
            }
            $definitions[] = ['name' => $template['name'], 'language' => self::LANGUAGE, 'category' => 'UTILITY', 'components' => $components];
        }

        return $definitions;
    }

    /** The template has a link button (its domain is fixed once submitted). */
    public static function hasButton(string $key): bool
    {
        return isset(self::UTILITY[$key]['button']);
    }

    /**
     * Send-time components for a utility template: the body values, and the link button's value.
     *
     * @param  list<string>  $params
     * @return list<array<string, mixed>>
     */
    public static function components(string $key, array $params, ?string $button): array
    {
        $components = [];
        if ($params !== []) {
            $components[] = ['type' => 'body', 'parameters' => array_map(fn (string $p): array => ['type' => 'text', 'text' => $p], $params)];
        }
        if ($button !== null && self::hasButton($key)) {
            $components[] = ['type' => 'button', 'sub_type' => 'url', 'index' => '0', 'parameters' => [['type' => 'text', 'text' => $button]]];
        }

        return $components;
    }

    /**
     * Send-time components for a code.
     *
     * @return list<array<string, mixed>>
     */
    public static function codeComponents(string $code): array
    {
        return [
            ['type' => 'body', 'parameters' => [['type' => 'text', 'text' => $code]]],
            ['type' => 'button', 'sub_type' => 'url', 'index' => '0', 'parameters' => [['type' => 'text', 'text' => $code]]],
        ];
    }

    private static function base(string $host): string
    {
        $name = $host === 'app' ? (string) config('landing.app_host') : (string) config('landing.platform_domain');

        return 'https://'.$name.'/';
    }
}
