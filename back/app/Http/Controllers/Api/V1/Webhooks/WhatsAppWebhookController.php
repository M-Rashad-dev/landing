<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Webhooks;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Messaging\WhatsApp\WhatsAppWebhook;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Meta's WhatsApp webhook, relayed by Next (/api/webhooks/whatsapp on the app host) with the
 * internal key, the raw body and Meta's signature header untouched.
 */
final class WhatsAppWebhookController extends Controller
{
    public function verify(Request $request, WhatsAppWebhook $webhook): Response
    {
        $challenge = $webhook->challenge(
            (string) $request->query('hub_mode', $request->query('hub.mode', '')),
            (string) $request->query('hub_verify_token', $request->query('hub.verify_token', '')),
            (string) $request->query('hub_challenge', $request->query('hub.challenge', '')),
        );
        if ($challenge === null) {
            throw new ApiException(403, 'forbidden', __('landing.forbidden'));
        }

        return response($challenge, 200, ['Content-Type' => 'text/plain']);
    }

    public function receive(Request $request, WhatsAppWebhook $webhook): JsonResponse
    {
        $raw = $request->getContent();
        if (! $webhook->signatureValid($raw, (string) $request->header('X-Hub-Signature-256', ''))) {
            throw new ApiException(403, 'forbidden', __('landing.forbidden'));
        }

        $payload = json_decode($raw, true);
        if (is_array($payload)) {
            $webhook->handle($payload);
        }

        return response()->json(['ok' => true]);
    }
}
