<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Webhooks;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\CarrierAccount;
use App\Models\Shipment;
use App\Shipping\ApplyShipmentUpdate;
use App\Shipping\Carriers\Carriers;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A carrier's status updates (Bosta posts one per state change), relayed by Next from
 * /api/webhooks/shipping/{carrier}/{token} with the internal key and the carrier's Authorization header as
 * X-Carrier-Auth. The token names the store's account; the header must be the secret we gave the carrier.
 */
final class ShippingWebhookController extends Controller
{
    public function receive(Request $request, string $carrier, string $token, Carriers $carriers, ApplyShipmentUpdate $updates): JsonResponse
    {
        if (! $carriers->has($carrier) || preg_match('/^[a-z0-9]{40}$/', $token) !== 1) {
            throw new ApiException(404, 'not_found', __('landing.forbidden'));
        }
        // Audited bypass: the token is unique platform-wide and unguessable; the account found here only names its
        // tenant, and everything after runs inside that tenant.
        /** @var CarrierAccount|null $account */
        $account = Tenancy::withoutTenant(fn () => CarrierAccount::query()->where('carrier', $carrier)->where('webhook_token', $token)->first());
        if ($account === null) {
            throw new ApiException(404, 'not_found', __('landing.forbidden'));
        }
        if (! hash_equals($account->webhook_secret, (string) $request->header('X-Carrier-Auth', ''))) {
            throw new ApiException(403, 'forbidden', __('landing.forbidden'));
        }

        $payload = $request->json()->all();
        Tenancy::runAs($account->tenant_id, function () use ($payload, $account, $carriers, $updates): void {
            $update = $carriers->get($account->carrier)->webhook($payload);
            if ($update === null) {
                return;
            }
            $shipment = Shipment::query()->where('carrier_account_id', $account->id)->where('tracking_number', $update->trackingNumber)->first();
            if ($shipment !== null) {
                $updates->handle($shipment, $update);
            }
        });

        // Unknown shipments are fine too: a 2xx stops the carrier from retrying.
        return response()->json(['ok' => true]);
    }
}
