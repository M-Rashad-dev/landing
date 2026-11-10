<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Billing\Entitlements;
use App\Enums\PlanLimit;
use App\Enums\WebhookEvent;
use App\Enums\WebhookKind;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\Webhook;
use App\Models\WebhookDelivery;
use App\Services\Webhooks\OutboundUrl;
use App\Services\Webhooks\WebhookPayloads;
use App\Services\Webhooks\WebhookSender;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** «الربط»: webhooks and Google Sheets. */
final class IntegrationController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly OutboundUrl $urls, private readonly Entitlements $entitlements) {}

    public function index(): JsonResponse
    {
        $webhooks = Webhook::query()->orderBy('id')->get();

        return $this->ok($webhooks->map(fn (Webhook $w) => $this->row($w))->all(), ['events' => WebhookEvent::subscribable()]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->entitlements->ensureCanAdd(PlanLimit::Webhooks);
        $data = $this->validated($request, null);

        $webhook = Webhook::query()->create($data + ['secret' => Str::random(48), 'is_active' => true]);

        return $this->created($this->row($webhook));
    }

    public function update(Request $request, Webhook $webhook): JsonResponse
    {
        $webhook->update($this->validated($request, $webhook->kind));

        return $this->ok($this->row($webhook));
    }

    public function toggle(Webhook $webhook): JsonResponse
    {
        $webhook->forceFill(['is_active' => ! $webhook->is_active, 'failures_count' => 0])->save();

        return $this->ok($this->row($webhook));
    }

    public function rotateSecret(Webhook $webhook): JsonResponse
    {
        $webhook->forceFill(['secret' => Str::random(48)])->save();

        return $this->ok($this->row($webhook));
    }

    /** Sends a sample order right away and returns the result. */
    public function test(Webhook $webhook, WebhookSender $sender, WebhookPayloads $payloads): JsonResponse
    {
        $delivery = $sender->send($webhook, WebhookEvent::Test->value, $payloads->sample());

        return $this->ok(['delivery' => $this->delivery($delivery), 'webhook' => $this->row($webhook->refresh())]);
    }

    public function deliveries(Webhook $webhook): JsonResponse
    {
        return $this->ok($webhook->deliveries()->orderByDesc('id')->limit(20)->get()->map(fn (WebhookDelivery $d) => $this->delivery($d))->all());
    }

    public function destroy(Webhook $webhook): Response
    {
        $webhook->delete();

        return $this->noContent();
    }

    /** @return array{kind?: WebhookKind, name: string, url: string, events: list<string>} */
    private function validated(Request $request, ?WebhookKind $kind): array
    {
        $data = $request->validate([
            'kind' => $kind === null ? ['required', Rule::enum(WebhookKind::class)] : ['prohibited'],
            'name' => ['required', 'string', 'max:80'],
            'url' => ['required', 'string', 'max:500'],
            'events' => ['required', 'array', 'min:1'],
            'events.*' => ['string', 'distinct', Rule::in(WebhookEvent::subscribable())],
        ]);
        $kind ??= WebhookKind::from($data['kind']);
        $url = trim($data['url']);
        $problem = $this->urls->problem($url, $kind);
        if ($problem !== null) {
            throw ValidationException::withMessages(['url' => [__($problem)]]);
        }

        return array_filter([
            'kind' => isset($data['kind']) ? $kind : null,
            'name' => trim(strip_tags($data['name'])),
            'url' => $url,
            'events' => array_values($data['events']),
        ], fn ($value) => $value !== null);
    }

    /** @return array<string, mixed> */
    private function row(Webhook $webhook): array
    {
        return [
            'id' => $webhook->id,
            'locked_by_plan' => $webhook->isLockedByPlan(),
            'kind' => $webhook->kind->value,
            'name' => $webhook->name,
            'url' => $webhook->url,
            'secret' => $webhook->secret,
            'events' => $webhook->events,
            'is_active' => $webhook->is_active,
            'failures_count' => $webhook->failures_count,
            'last_status' => $webhook->last_status,
            'last_delivery_at' => $webhook->last_delivery_at?->toIso8601ZuluString(),
        ];
    }

    /** @return array<string, mixed> */
    private function delivery(WebhookDelivery $delivery): array
    {
        return [
            'id' => $delivery->id,
            'event' => $delivery->event,
            'status' => $delivery->status,
            'response_code' => $delivery->response_code,
            'error' => $delivery->error,
            'attempt' => $delivery->attempt,
            'duration_ms' => $delivery->duration_ms,
            'created_at' => $delivery->created_at->toIso8601ZuluString(),
        ];
    }
}
