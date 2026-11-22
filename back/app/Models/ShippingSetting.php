<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * Store-wide delivery switch (one row per tenant). Fees live on the shipping companies.
 *
 * @property int $id
 * @property bool $enabled
 * @property string $company_choice
 * @property array<string, int>|null $governorate_companies
 */
class ShippingSetting extends Model
{
    use BelongsToTenant;

    public const CHOICE_CUSTOMER = 'customer';

    public const CHOICE_GOVERNORATE = 'governorate';

    protected $fillable = ['enabled', 'company_choice', 'governorate_companies'];

    protected function casts(): array
    {
        return ['enabled' => 'boolean', 'governorate_companies' => 'array'];
    }
}
