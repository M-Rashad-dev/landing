<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\ManageTenant;
use App\Enums\MessagePurpose;
use App\Enums\MessageStatus;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Messaging\WhatsApp\WhatsAppError;
use App\Messaging\WhatsApp\WhatsAppGateway;
use App\Messaging\WhatsApp\WhatsAppTemplateSync;
use App\Models\OutboundMessage;
use App\Services\PhoneNormalizer;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The super admin's WhatsApp page: is the number connected, are the templates approved, how many
 * messages went out (and how they ended), and the message log. Meta is asked live on each visit.
 */
final class MessageController extends Controller
{
    use RespondsWithJson;

    public function overview(WhatsAppGateway $gateway, WhatsAppTemplateSync $sync): JsonResponse
    {
        $phone = null;
        $templates = [];
        $error = null;
        if ($gateway->configured()) {
            try {
                $phone = $gateway->phoneNumber();
                $templates = $sync->status();
            } catch (WhatsAppError $e) {
                $error = $e->title;
            }
        }

        $today = now('Africa/Cairo')->startOfDay()->utc();

        return $this->ok([
            'configured' => $gateway->configured(),
            'phone' => $phone,
            'templates' => $templates,
            'error' => $error,
            'today' => $this->counts(OutboundMessage::query()->where('created_at', '>=', $today)),
            'month' => $this->counts(OutboundMessage::query()->where('created_at', '>=', now()->subDays(30))),
        ]);
    }

    public function index(Request $request, PhoneNormalizer $phones): JsonResponse
    {
        $request->validate([
            'status' => ['nullable', Rule::in(MessageStatus::values())],
            'purpose' => ['nullable', Rule::in(MessagePurpose::values())],
            'phone' => ['nullable', 'string', 'max:30'],
        ]);
        $phone = $phones->normalize((string) $request->query('phone', ''));

        $page = OutboundMessage::query()
            ->with('tenant:id,name')
            ->when($request->filled('status'), fn (Builder $q) => $q->where('status', (string) $request->query('status')))
            ->when($request->filled('purpose'), fn (Builder $q) => $q->where('purpose', (string) $request->query('purpose')))
            ->when($request->filled('phone'), fn (Builder $q) => $q->where('recipient', $phone ?? '-'))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return $this->ok(
            $page->getCollection()->map(fn (OutboundMessage $m): array => [
                'id' => $m->id,
                'recipient' => $m->recipient,
                'purpose' => $m->purpose->value,
                'template' => $m->template,
                'status' => $m->status->value,
                'error' => $m->error_title,
                'error_code' => $m->error_code,
                'tenant' => $m->tenant ? ['id' => $m->tenant->id, 'name' => $m->tenant->name] : null,
                'created_at' => $m->created_at->toIso8601ZuluString(),
                'delivered_at' => $m->delivered_at?->toIso8601ZuluString(),
                'read_at' => $m->read_at?->toIso8601ZuluString(),
            ])->values()->all(),
            ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        );
    }

    /** Submits the templates Meta doesn't have yet (the same as `php artisan whatsapp:templates push`). */
    public function pushTemplates(WhatsAppGateway $gateway, WhatsAppTemplateSync $sync, ManageTenant $audit): JsonResponse
    {
        if (! $gateway->configured()) {
            throw new ApiException(409, 'whatsapp_not_configured', __('messaging.admin.not_configured'));
        }

        try {
            $result = $sync->push();
        } catch (WhatsAppError $e) {
            throw new ApiException(502, 'whatsapp_error', __('messaging.admin.meta_error', ['error' => $e->title]));
        }

        if ($result['submitted'] !== []) {
            $audit->audit('whatsapp.templates_push', 'whatsapp', ['templates' => $result['submitted']], 'settings');
        }

        return $this->ok($result);
    }

    /**
     * @param  Builder<OutboundMessage>  $query
     * @return array{total: int, delivered: int, read: int, failed: int}
     */
    private function counts(Builder $query): array
    {
        $count = fn (MessageStatus ...$statuses): int => (clone $query)->whereIn('status', array_map(fn (MessageStatus $s) => $s->value, $statuses))->count();

        return [
            'total' => (clone $query)->count(),
            // "Delivered" includes the read ones (read means it arrived).
            'delivered' => $count(MessageStatus::Delivered, MessageStatus::Read),
            'read' => $count(MessageStatus::Read),
            'failed' => $count(MessageStatus::Failed),
        ];
    }
}
