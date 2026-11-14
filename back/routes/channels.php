<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
| Private realtime channels (Reverb), authorised at POST /api/v1/broadcasting/auth with the
| dashboard token. Each store hears only its own support tickets; the platform's support hears all.
*/

// A store's support conversations (its owner's dashboard).
// The id arrives from the channel name as a string.
Broadcast::channel('support.tenant.{tenantId}', fn (User $user, string $tenantId): bool => ! $user->isSuperAdmin() && $user->is_active && (string) $user->tenant_id === $tenantId, ['guards' => ['sanctum']]);

// Every support conversation (the platform admin).
Broadcast::channel('support.admin', fn (User $user): bool => $user->isSuperAdmin() && $user->is_active, ['guards' => ['sanctum']]);
