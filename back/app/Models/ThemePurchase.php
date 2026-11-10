<?php

declare(strict_types=1);

namespace App\Models;

use App\Billing\Themes\ThemeAccess;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * A paid theme a store owns forever (bought, or given by the admin).
 *
 * @property int $id
 * @property int $tenant_id
 * @property string $theme_key
 * @property string $source purchase | admin_grant
 * @property int|null $invoice_id
 * @property string $price_paid decimal string
 * @property string|null $note
 * @property int|null $created_by
 */
class ThemePurchase extends Model
{
    use BelongsToTenant;

    protected $fillable = ['tenant_id', 'theme_key', 'source', 'invoice_id', 'price_paid', 'note', 'created_by'];

    protected function casts(): array
    {
        return ['price_paid' => 'decimal:2'];
    }

    protected static function booted(): void
    {
        static::saved(fn (ThemePurchase $p) => ThemeAccess::forget($p->tenant_id));
        static::deleted(fn (ThemePurchase $p) => ThemeAccess::forget($p->tenant_id));
    }
}
