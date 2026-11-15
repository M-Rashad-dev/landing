<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\NotifyChannel;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/**
 * The bell of the signed-in dashboard user (store owner or super admin): always their own rows
 * only. Store owners also choose here where the outside copy goes (WhatsApp or email).
 */
final class NotificationController extends Controller
{
    use RespondsWithJson;

    private const PER_PAGE = 20;

    public function index(Request $request): JsonResponse
    {
        $request->validate(['before' => ['nullable', 'integer', 'min:1']]);
        $user = $this->user($request);

        $rows = UserNotification::query()
            ->where('user_id', $user->id)
            ->when($request->filled('before'), fn ($q) => $q->where('id', '<', $request->integer('before')))
            ->orderByDesc('id')
            ->limit(self::PER_PAGE + 1)
            ->get();

        return $this->ok([
            'items' => $rows->take(self::PER_PAGE)->map(fn (UserNotification $n): array => $n->toBell())->values()->all(),
            'has_more' => $rows->count() > self::PER_PAGE,
            'unread' => UserNotification::query()->where('user_id', $user->id)->whereNull('read_at')->count(),
        ]);
    }

    public function read(Request $request, int $notification): Response
    {
        UserNotification::query()
            ->where('user_id', $this->user($request)->id)
            ->whereKey($notification)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return $this->noContent();
    }

    public function readAll(Request $request): Response
    {
        UserNotification::query()->where('user_id', $this->user($request)->id)->whereNull('read_at')->update(['read_at' => now()]);

        return $this->noContent();
    }

    public function channel(Request $request): JsonResponse
    {
        return $this->ok(['channel' => $this->user($request)->notify_channel->value]);
    }

    public function updateChannel(Request $request): JsonResponse
    {
        $data = $request->validate(['channel' => ['required', Rule::enum(NotifyChannel::class)]]);
        $user = $this->user($request);
        $user->forceFill(['notify_channel' => $data['channel']])->save();

        return $this->ok(['channel' => $user->notify_channel->value]);
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }
}
