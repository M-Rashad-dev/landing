<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A reminder an abandoned lead got (step 1 or 2, WhatsApp or email).
 *
 * @property int $id
 * @property int $abandoned_lead_id
 * @property int $step
 * @property string $channel whatsapp | email
 * @property int|null $outbound_message_id
 * @property bool $charged
 * @property string|null $coupon_code
 * @property Carbon $created_at
 */
class LeadReminder extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    protected $fillable = ['abandoned_lead_id', 'step', 'channel', 'outbound_message_id', 'charged', 'coupon_code'];

    protected function casts(): array
    {
        return ['step' => 'integer', 'charged' => 'boolean', 'created_at' => 'datetime'];
    }

    /** @return BelongsTo<AbandonedLead, $this> */
    public function lead(): BelongsTo
    {
        return $this->belongsTo(AbandonedLead::class, 'abandoned_lead_id');
    }
}
