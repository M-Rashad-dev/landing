<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Webhooks;

use App\Http\Controllers\Controller;
use App\Store\Payments\Gateways\GatewayError;
use App\Store\Payments\OnlineStorePayments;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * A store's gateway webhook (/webhooks/payments/{gateway}/{token}, relayed by Next with the raw body, the query and the
 * signature headers untouched): the checkout it is about is settled from the gateway itself. 403 on a wrong account or
 * signature; 500 when the gateway can't be asked back, so it delivers again.
 */
final class StorePaymentWebhookController extends Controller
{
    /** Signature headers the gateways send (lower-case). */
    private const HEADERS = ['xpay-signature', 'x-kashier-signature', 'x-fake-signature'];

    public function receive(Request $request, string $gateway, string $token, OnlineStorePayments $online): Response
    {
        $headers = [];
        foreach (self::HEADERS as $name) {
            $headers[$name] = (string) $request->header($name, '');
        }
        $query = array_map(fn ($v) => is_scalar($v) ? (string) $v : '', (array) $request->query());

        try {
            $valid = $online->webhook($gateway, $token, $request->getContent(), $headers, $query);
        } catch (GatewayError $e) {
            report($e);

            return response('', 500);
        }

        return response('', $valid ? 200 : 403);
    }
}
