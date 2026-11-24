<?php

declare(strict_types=1);

namespace App\Auth;

use App\Enums\UserRole;
use App\Models\User;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

/**
 * Every dashboard page and what can be done on it, as permission keys «page.action» (spatie/laravel-permission,
 * given directly to staff users). The store owner holds every permission implicitly; staff hold what they are
 * given. config/permissions.php maps each dashboard route to one key.
 */
final class PermissionCatalog
{
    public const GUARD = 'web';

    /** Routes any signed-in staff member may use (lookups other pages need: media library, plan usage, price preview). */
    public const ANY = '@any';

    /** The person's own things (profile, password, notifications): always allowed. */
    public const SELF = '@self';

    /** @var array<string, array{label: string, group: string, actions: array<string, string>}> */
    public const PAGES = [
        'home' => ['label' => 'الرئيسية', 'group' => 'عام', 'actions' => ['view' => 'عرض']],
        'copilot' => ['label' => 'مساعد مكسب الذكي', 'group' => 'عام', 'actions' => ['use' => 'استخدام']],
        'orders' => ['label' => 'الطلبات', 'group' => 'المبيعات', 'actions' => [
            'view' => 'عرض', 'update' => 'تعديل بيانات العميل والملاحظات', 'status' => 'تغيير الحالة', 'confirm' => 'طابور التأكيد', 'auto_confirm' => 'إعدادات التأكيد على واتساب',
            'export' => 'تصدير', 'ship' => 'الشحن مع شركات الشحن', 'payments' => 'مراجعة إيصالات الدفع', 'deliveries' => 'تسليم المنتجات الرقمية',
        ]],
        'abandoned' => ['label' => 'الطلبات المتروكة', 'group' => 'المبيعات', 'actions' => ['view' => 'عرض', 'update' => 'تعديل', 'delete' => 'حذف', 'recovery' => 'تذكيرات السلات ورصيد الرسائل']],
        'customers' => ['label' => 'العملاء', 'group' => 'المبيعات', 'actions' => ['view' => 'عرض', 'update' => 'تعديل', 'block' => 'الحظر']],
        'reviews' => ['label' => 'التقييمات', 'group' => 'المبيعات', 'actions' => ['view' => 'عرض', 'update' => 'إخفاء وإظهار']],
        'products' => ['label' => 'المنتجات', 'group' => 'المتجر', 'actions' => [
            'view' => 'عرض', 'create' => 'إضافة', 'update' => 'تعديل', 'delete' => 'حذف', 'import' => 'استيراد', 'digital' => 'ملفات وأكواد المنتجات الرقمية', 'cost' => 'تكلفة المنتجات (عرض وتعديل)',
        ]],
        'categories' => ['label' => 'التصنيفات', 'group' => 'المتجر', 'actions' => ['view' => 'عرض', 'create' => 'إضافة', 'update' => 'تعديل', 'delete' => 'حذف']],
        'media' => ['label' => 'مكتبة الصور', 'group' => 'المتجر', 'actions' => ['delete' => 'حذف صور']],
        'shipping' => ['label' => 'الشحن', 'group' => 'المتجر', 'actions' => ['view' => 'عرض', 'update' => 'تعديل الشركات والأسعار', 'carriers' => 'ربط شركات الشحن']],
        'store' => ['label' => 'إعدادات المتجر', 'group' => 'المتجر', 'actions' => ['view' => 'عرض', 'update' => 'تعديل']],
        'design' => ['label' => 'الثيم والرئيسية', 'group' => 'التصميم', 'actions' => ['view' => 'عرض', 'update' => 'تعديل التصميم والهوية', 'publish' => 'نشر', 'ai' => 'مصمم الذكاء الاصطناعي']],
        'store_pages' => ['label' => 'الصفحات الثابتة', 'group' => 'التصميم', 'actions' => ['view' => 'عرض', 'create' => 'إضافة', 'update' => 'تعديل', 'delete' => 'حذف']],
        'offers' => ['label' => 'العروض', 'group' => 'التسويق', 'actions' => ['view' => 'عرض', 'create' => 'إضافة', 'update' => 'تعديل', 'delete' => 'حذف']],
        'coupons' => ['label' => 'الكوبونات', 'group' => 'التسويق', 'actions' => ['view' => 'عرض', 'create' => 'إضافة', 'update' => 'تعديل', 'delete' => 'حذف']],
        'upsells' => ['label' => 'عروض ما بعد الطلب', 'group' => 'التسويق', 'actions' => ['view' => 'عرض', 'create' => 'إضافة', 'update' => 'تعديل', 'delete' => 'حذف']],
        'landings' => ['label' => 'صفحات الهبوط', 'group' => 'التسويق', 'actions' => ['view' => 'عرض', 'create' => 'إضافة', 'update' => 'تعديل', 'delete' => 'حذف', 'publish' => 'نشر وإيقاف', 'ab_tests' => 'اختبارات A/B']],
        'analytics' => ['label' => 'التحليلات', 'group' => 'التحليلات', 'actions' => ['view' => 'عرض']],
        'profit' => ['label' => 'الأرباح', 'group' => 'التحليلات', 'actions' => ['view' => 'عرض', 'expenses' => 'المصروفات وتكلفة التغليف']],
        'domains' => ['label' => 'النطاقات', 'group' => 'الإعدادات', 'actions' => ['view' => 'عرض', 'manage' => 'إضافة وتعديل وحذف']],
        'billing' => ['label' => 'الباقة والفواتير', 'group' => 'الإعدادات', 'actions' => ['view' => 'عرض', 'pay' => 'الاشتراك والدفع']],
        'ai_wallet' => ['label' => 'رصيد الذكاء الاصطناعي', 'group' => 'الإعدادات', 'actions' => ['view' => 'عرض']],
        'pixels' => ['label' => 'البيكسلات', 'group' => 'الإعدادات', 'actions' => ['view' => 'عرض', 'update' => 'تعديل']],
        'integrations' => ['label' => 'الربط', 'group' => 'الإعدادات', 'actions' => ['view' => 'عرض', 'update' => 'إضافة وتعديل وحذف']],
        'payments' => ['label' => 'الدفع', 'group' => 'الإعدادات', 'actions' => ['view' => 'عرض', 'update' => 'تعديل']],
        'emails' => ['label' => 'الإيميلات', 'group' => 'الإعدادات', 'actions' => ['view' => 'عرض', 'update' => 'تعديل']],
        'staff' => ['label' => 'الموظفين', 'group' => 'الإعدادات', 'actions' => ['view' => 'عرض', 'create' => 'إضافة', 'update' => 'تعديل الصلاحيات والإيقاف', 'delete' => 'حذف']],
        'activity' => ['label' => 'سجل النشاط', 'group' => 'الإعدادات', 'actions' => ['view' => 'عرض']],
        'support' => ['label' => 'الدعم', 'group' => 'عام', 'actions' => ['use' => 'محادثة الدعم']],
    ];

    /** @return list<string> every key, «page.action» */
    public static function keys(): array
    {
        $keys = [];
        foreach (self::PAGES as $page => $def) {
            foreach (array_keys($def['actions']) as $action) {
                $keys[] = $page.'.'.$action;
            }
        }

        return $keys;
    }

    public static function exists(string $key): bool
    {
        return in_array($key, self::keys(), true);
    }

    /** The Arabic name of a key («المنتجات: إضافة»). */
    public static function label(string $key): string
    {
        [$page, $action] = array_pad(explode('.', $key, 2), 2, '');

        return isset(self::PAGES[$page]['actions'][$action]) ? self::PAGES[$page]['label'].': '.self::PAGES[$page]['actions'][$action] : $key;
    }

    /** The owner can do everything; staff what they were given; a special key passes for anyone signed in. */
    public static function allows(?User $user, string $key): bool
    {
        if ($user === null) {
            return false;
        }
        if ($key === self::ANY || $key === self::SELF || $user->role !== UserRole::Staff) {
            return true;
        }

        return $user->hasPermissionTo($key, self::GUARD);
    }

    /** Creates the keys that don't exist yet and removes the ones that left the catalog. */
    public static function sync(): int
    {
        $keys = self::keys();
        $created = 0;
        foreach ($keys as $key) {
            if (Permission::query()->where('name', $key)->where('guard_name', self::GUARD)->doesntExist()) {
                Permission::query()->create(['name' => $key, 'guard_name' => self::GUARD]);
                $created++;
            }
        }
        Permission::query()->where('guard_name', self::GUARD)->whereNotIn('name', $keys)->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return $created;
    }
}
