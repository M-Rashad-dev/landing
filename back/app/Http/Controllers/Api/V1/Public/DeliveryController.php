<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public;

use App\Enums\DeliveryType;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\OrderDelivery;
use App\Services\PublicSite;
use App\Store\Digital\DigitalDeliveries;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * A buyer's downloads and link (the delivery's private 40-character token): each one counted, refused with a
 * friendly message once used up.
 */
final class DeliveryController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly PublicSite $site, private readonly DigitalDeliveries $deliveries) {}

    public function download(Request $request, string $token, int $file): BinaryFileResponse
    {
        return $this->inDelivery($request, $token, DeliveryType::Files, function (OrderDelivery $delivery) use ($file): BinaryFileResponse {
            $got = $this->deliveries->download($delivery, $file) ?? throw new ApiException(410, 'downloads_used_up', __('digital.used_up'));

            return response()->download($got['path'], $got['name'], [
                'Content-Type' => $got['mime'],
                'Cache-Control' => 'private, no-store',
                'X-Content-Type-Options' => 'nosniff',
            ]);
        });
    }

    public function open(Request $request, string $token): JsonResponse
    {
        return $this->inDelivery($request, $token, DeliveryType::Links, function (OrderDelivery $delivery): JsonResponse {
            $url = $this->deliveries->open($delivery) ?? throw new ApiException(410, 'opens_used_up', __('digital.link_used_up'));

            return $this->ok(['url' => $url])->header('Cache-Control', 'no-store, private');
        });
    }

    private function inDelivery(Request $request, string $token, DeliveryType $type, \Closure $then): mixed
    {
        $request->validate(['host' => ['required', 'string', 'max:253']]);
        if (preg_match('/^[a-z0-9]{40}$/', $token) !== 1) {
            throw new ApiException(404, 'not_found', __('landing.not_found'));
        }
        $domain = $this->site->activeDomainOrFail((string) $request->input('host', $request->query('host')));

        return Tenancy::runAs($domain->tenant_id, function () use ($token, $type, $then) {
            $delivery = OrderDelivery::query()->where('token', $token)->where('type', $type)->where('status', OrderDelivery::DELIVERED)->first()
                ?? throw new ApiException(404, 'not_found', __('landing.not_found'));

            return $then($delivery);
        });
    }
}
