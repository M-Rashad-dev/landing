<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\StoreMailMode;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * How the store's customer emails go out (one row per store, made on first save). The SMTP password is encrypted
 * and never leaves the server.
 *
 * @property int $id
 * @property int $tenant_id
 * @property StoreMailMode $mode
 * @property string|null $sender_name shown as the sender (default: the store's name)
 * @property string|null $reply_to where customer replies go (default: the identity's contact email, else the owner's)
 * @property string|null $smtp_host
 * @property int|null $smtp_port
 * @property string|null $smtp_encryption ssl | tls
 * @property string|null $smtp_username
 * @property string|null $smtp_password
 * @property string|null $from_address the mailbox's own address (default: the username)
 * @property string|null $status active | failed (the last time the mailbox was used or checked)
 * @property string|null $last_error
 * @property Carbon|null $checked_at
 */
class StoreMailSetting extends Model
{
    use BelongsToTenant;

    public const ACTIVE = 'active';

    public const FAILED = 'failed';

    public const ENCRYPTIONS = ['ssl', 'tls'];

    public const PORTS = [25, 465, 587, 2525];

    protected $fillable = [
        'mode', 'sender_name', 'reply_to', 'smtp_host', 'smtp_port', 'smtp_encryption', 'smtp_username', 'smtp_password',
        'from_address', 'status', 'last_error', 'checked_at',
    ];

    protected $hidden = ['smtp_password'];

    protected $attributes = ['mode' => 'platform'];

    protected function casts(): array
    {
        return [
            'mode' => StoreMailMode::class,
            'smtp_port' => 'integer',
            'smtp_password' => 'encrypted',
            'checked_at' => 'datetime',
        ];
    }

    public function usesSmtp(): bool
    {
        return $this->mode === StoreMailMode::Smtp && $this->smtp_host !== null && $this->smtp_password !== null;
    }

    /** The address the mailbox sends as. */
    public function fromAddress(): string
    {
        return (string) ($this->from_address ?: $this->smtp_username);
    }
}
