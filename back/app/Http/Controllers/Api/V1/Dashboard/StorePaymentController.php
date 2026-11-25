<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Enums\OrderStatus;
use App\Enums\StorePaymentKind;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\StorePaymentMethodRequest;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Order;
use App\Models\StorePaymentMethod;
use App\Models\StorePaymentSetting;
use App\Store\Payments\OnlineStorePayments;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * «الإعدادات» → «الدفع»: cash on delivery, the store's own prepaid methods, the online gateways it connects with its own
 * account (Paymob, Kashier, XPay), and when unpaid orders are cancelled.
 */
final class StorePaymentController extends Controller
{
    use RespondsWithJson;

    public function show(): JsonResponse
    {
        return $this->ok($this->state());
    }

    public function settings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cod_enabled' => ['required', 'boolean'],
            'cancel_after_days' => ['required', 'integer', 'between:1,30'],
        ]);
        $settings = StorePaymentSetting::current();
        $settings->fill($data)->save();
        $this->refreshSites();

        return $this->ok($this->state());
    }

    public function store(StorePaymentMethodRequest $request): JsonResponse
    {
        if (StorePaymentMethod::query()->count() >= StorePaymentMethod::MAX) {
            throw new ApiException(422, 'too_many_methods', __('validation.max.array', ['attribute' => 'methods', 'max' => StorePaymentMethod::MAX]));
        }
        StorePaymentMethod::query()->create([...$request->validated(), 'position' => (int) StorePaymentMethod::query()->max('position') + 1]);
        $this->refreshSites();

        return $this->created($this->state());
    }

    public function update(StorePaymentMethodRequest $request, StorePaymentMethod $method): JsonResponse
    {
        $this->notOnline($method);
        $method->fill($request->validated())->save();
        $this->refreshSites();

        return $this->ok($this->state());
    }

    public function destroy(StorePaymentMethod $method): Response
    {
        $this->notOnline($method);
        // Customers still paying with it need to see where to send the money.
        if (Order::query()->where('store_payment_method_id', $method->id)->where('status', OrderStatus::AwaitingPayment)->exists()) {
            throw new ApiException(422, 'method_used', __('payments.method_used'));
        }
        $method->delete();
        $this->refreshSites();

        return $this->noContent();
    }

    /** «اربط»: the merchant's own gateway account (credentials checked at the gateway, kept encrypted). */
    public function connect(Request $request, string $gateway, OnlineStorePayments $online): JsonResponse
    {
        $data = $request->validate(['credentials' => ['required', 'array', 'max:10'], 'credentials.*' => ['nullable', 'string', 'max:500']]);
        $online->connect($gateway, $data['credentials']);
        $this->refreshSites();

        return $this->ok($this->state());
    }

    public function disconnect(string $gateway, OnlineStorePayments $online): JsonResponse
    {
        $online->disconnect($gateway);
        $this->refreshSites();

        return $this->ok($this->state());
    }

    /** An online method follows its gateway (connect / disconnect), never edited by hand. */
    private function notOnline(StorePaymentMethod $method): void
    {
        if ($method->kind === StorePaymentKind::Online) {
            throw new ApiException(422, 'gateway_method', __('payments.gateways.manage_there'));
        }
    }

    /** @return array<string, mixed> */
    private function state(): array
    {
        $settings = StorePaymentSetting::current();

        return [
            'cod_enabled' => $settings->cod_enabled,
            'cancel_after_days' => $settings->cancel_after_days,
            'methods' => StorePaymentMethod::query()->orderBy('position')->orderBy('id')->get()
                ->map(fn (StorePaymentMethod $m) => [...$m->publicView(), 'is_active' => $m->is_active])->values()->all(),
            'gateways' => app(OnlineStorePayments::class)->overview(),
        ];
    }

    private function refreshSites(): void
    {
        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();
    }
}
