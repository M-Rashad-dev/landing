<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * An image or video sent in a support conversation, kept on the private disk and served only to
 * the store and the platform's support.
 *
 * @property int $id
 * @property int $tenant_id
 * @property int $support_ticket_id
 * @property int $support_message_id
 * @property string $kind image | video
 * @property string $path
 * @property string $name
 * @property string $mime
 * @property int $size
 */
class SupportAttachment extends Model
{
    use BelongsToTenant;

    protected $fillable = ['support_ticket_id', 'support_message_id', 'kind', 'path', 'name', 'mime', 'size'];

    protected function casts(): array
    {
        return ['size' => 'integer'];
    }
}
