<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions;

use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Ai\Copilot\Support\ToolResult;
use App\Enums\WebhookEvent;
use App\Models\Webhook;
use App\Services\Webhooks\WebhookPayloads;
use App\Services\Webhooks\WebhookSender;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Sends a sample order to a webhook / Google Sheet now (the integrations page's «جرّب») and gives the result: status,
 * response code and error. Never the secret, the URL or the payload.
 */
final class WebhooksTest extends CopilotAction
{
    public function __construct(private readonly WebhookSender $sender, private readonly WebhookPayloads $payloads) {}

    public function key(): string
    {
        return 'webhooks.test';
    }

    public function label(): string
    {
        return 'تجربة الربط';
    }

    public function summary(): string
    {
        return 'Send a sample order to one integration (webhook / Google Sheet) now and see whether it answered; use with the webhook_deliveries resource to find why a link fails.';
    }

    public function schema(): array
    {
        return ['type' => 'object', 'properties' => ['webhook_id' => ['type' => 'integer']], 'required' => ['webhook_id']];
    }

    public function approval(): bool
    {
        return false;
    }

    public function run(array $args, CopilotContext $ctx): ToolResult
    {
        $webhook = Webhook::query()->find((int) ($args['webhook_id'] ?? 0)) ?? throw new CopilotToolError('No integration with that id in this store.');
        // The integrations page's pace for tests.
        $key = 'integration-tests:'.$ctx->tenant->id;
        if (RateLimiter::tooManyAttempts($key, 5)) {
            throw new CopilotToolError('Too many tests this minute; try again in a minute.');
        }
        RateLimiter::hit($key, 60);
        $delivery = $this->sender->send($webhook, WebhookEvent::Test->value, $this->payloads->sample());

        return ToolResult::ok(['test' => ['status' => $delivery->status, 'response_code' => $delivery->response_code, 'error' => $delivery->error, 'duration_ms' => $delivery->duration_ms]]);
    }
}
