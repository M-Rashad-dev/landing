<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Domain;
use App\Services\DomainRules;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Domain */
final class DomainResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'host' => $this->host,
            'type' => $this->type->value,
            'status' => $this->status->value,
            'locked_by_plan' => (bool) $this->locked_by_plan,
            'is_primary' => $this->is_primary,
            'verified_at' => $this->verified_at?->toIso8601ZuluString(),
            'check_attempts' => $this->check_attempts,
            'last_checked_at' => $this->last_checked_at?->toIso8601ZuluString(),
            'last_check_error' => $this->last_check_error,
            'ssl_status' => $this->ssl_status->value,
            'ssl_checked_at' => $this->ssl_checked_at?->toIso8601ZuluString(),
            'created_at' => $this->created_at?->toIso8601ZuluString(),
            'instructions' => DomainRules::instructions($this->resource),
        ];
    }
}
