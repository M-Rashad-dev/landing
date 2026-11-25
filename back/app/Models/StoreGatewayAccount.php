<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A store's own account at an online payment gateway (App\Store\Payments\OnlineStorePayments). The credentials are
 * encrypted at rest and never leave the server.
 *
 * @property int $id
 * @property int $tenant_id
 * @property string $gateway paymob | kashier | xpay
 * @property array<string, string> $credentials
 * @property string $mode test | live
 * @property string $status active | failed
 * @property string $webhook_token
 * @property string|null $last_error
 * @property Carbon|null $connected_at
 */
class StoreGatewayAccount extends Model
{
    use BelongsToTenant;

    public const ACTIVE = 'active';

    public const FAILED = 'failed';

    protected $fillable = ['gateway', 'credentials', 'mode', 'status', 'webhook_token', 'last_error', 'connected_at'];

    protected $hidden = ['credentials'];

    protected function casts(): array
    {
        return ['credentials' => 'encrypted:array', 'connected_at' => 'datetime'];
    }

    /** One credential as a string ('' when missing). */
    public function credential(string $key): string
    {
        return trim((string) (($this->credentials ?? [])[$key] ?? ''));
    }
}
