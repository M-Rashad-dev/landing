<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\CarrierPickupRequest;
use App\Http\Requests\Dashboard\CarrierSettingsRequest;
use App\Http\Requests\Dashboard\ConnectCarrierRequest;
use App\Http\Resources\CarrierAccountResource;
use App\Models\CarrierAccount;
use App\Models\User;
use App\Shipping\Carriers\Carrier;
use App\Shipping\Carriers\CarrierError;
use App\Shipping\Carriers\Carriers;
use App\Shipping\ConnectCarrier;
use App\Shipping\ManageShipments;
use App\Shipping\ShipOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** The carriers a store can connect («شركات الشحن» → «اربط شركة شحن») and its connected accounts. */
final class CarrierAccountController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly Carriers $carriers, private readonly ConnectCarrier $connect) {}

    public function index(Request $request): JsonResponse
    {
        $accounts = CarrierAccount::query()->with('company')->get()->keyBy('carrier');

        return $this->ok(array_map(function (string $key) use ($accounts, $request): array {
            $carrier = $this->carriers->get($key);
            $account = $accounts->get($key);

            return [
                'key' => $key,
                'name' => $carrier->label(),
                'fields' => array_map(fn (array $f) => [...$f, 'label' => (string) __('shipping.carriers.fields.'.$key.'.'.$f['key'])], $carrier->credentialFields()),
                'features' => $carrier->features(),
                // Carriers whose console takes our address for status updates (J&T): shown to paste there.
                'webhook_url' => $account !== null && in_array(Carrier::WEBHOOK_URL, $carrier->features(), true) ? ShipOrder::webhookUrl($account) : null,
                'account' => $account !== null ? CarrierAccountResource::make($account)->resolve($request) : null,
            ];
        }, $this->carriers->keys()));
    }

    public function connect(ConnectCarrierRequest $request, string $carrier): JsonResponse
    {
        $account = $this->connect->handle($this->carriers->get($carrier)->key(), $request->credentials(), $request->validated('company_id') === null ? null : (int) $request->validated('company_id'));

        return $this->ok(CarrierAccountResource::make($account));
    }

    public function update(CarrierSettingsRequest $request, string $carrier): JsonResponse
    {
        return $this->ok(CarrierAccountResource::make($this->connect->settings($this->account($carrier), $request->validated())->load('company')));
    }

    /** «اختبر الربط»: the key checked again, and the pickup locations to choose from. */
    public function check(string $carrier): JsonResponse
    {
        $account = $this->account($carrier);
        $profile = $this->connect->check($account);

        return $this->ok(['account' => CarrierAccountResource::make($account->load('company')), 'locations' => $profile->locations]);
    }

    /** The carrier's delivery areas in a governorate (the ship dialog's list). */
    public function districts(Request $request, string $carrier): JsonResponse
    {
        $data = $request->validate(['governorate' => ['required', 'string', 'in:'.implode(',', (array) config('landing.governorates'))]]);
        $account = $this->account($carrier);
        try {
            return $this->ok($this->carriers->get($carrier)->districts($account, (string) $data['governorate']));
        } catch (CarrierError $e) {
            throw new ApiException(422, 'carrier_refused', $e->getMessage());
        }
    }

    public function pickup(CarrierPickupRequest $request, string $carrier, ManageShipments $shipments): Response
    {
        /** @var User $user */
        $user = $request->user();
        $shipments->pickup($this->account($carrier), (string) $request->validated('date'), (int) $request->validated('parcels'), $request->validated('notes'), $user);

        return $this->noContent();
    }

    public function destroy(string $carrier): Response
    {
        $this->connect->disconnect($this->account($carrier));

        return $this->noContent();
    }

    private function account(string $carrier): CarrierAccount
    {
        $this->carriers->get($carrier);

        return CarrierAccount::query()->where('carrier', $carrier)->first()
            ?? throw new ApiException(404, 'carrier_not_connected', (string) __('shipping.carriers.not_connected'));
    }
}
