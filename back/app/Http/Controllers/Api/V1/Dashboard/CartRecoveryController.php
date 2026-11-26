<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Billing\Entitlements;
use App\Enums\InvoiceStatus;
use App\Enums\PlanFeature;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Jobs\SendManualReminders;
use App\Models\CartRecoverySetting;
use App\Models\DiscountCode;
use App\Models\Invoice;
use App\Models\MessageWallet;
use App\Models\MessageWalletEntry;
use App\Recovery\CartRecovery;
use App\Recovery\MessageWallets;
use App\Rules\TenantExists;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * «تذكير السلات المتروكة» (docs/plans/merchant-essentials.md, stage 4): on / off per channel, the timings and the
 * second reminder's coupon, the WhatsApp message balance with the packs on sale (bought through billing), a pack
 * waiting for its receipt, the balance's moves and the last 30 days.
 */
final class CartRecoveryController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly CartRecovery $recovery, private readonly MessageWallets $wallets) {}

    public function show(Entitlements $entitlements): JsonResponse
    {
        $entitlements->ensure(PlanFeature::AbandonedLeads);

        return $this->ok($this->state());
    }

    public function update(Request $request, Entitlements $entitlements): JsonResponse
    {
        $entitlements->ensure(PlanFeature::AbandonedLeads);
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'whatsapp' => ['required', 'boolean'],
            'email' => ['required', 'boolean'],
            'first_minutes' => ['required', 'integer', 'between:15,1440'],
            'second_hours' => ['nullable', 'integer', 'between:2,48'],
            'coupon_mode' => ['required', Rule::in([CartRecoverySetting::COUPON_NONE, CartRecoverySetting::COUPON_CODE, CartRecoverySetting::COUPON_GENERATED])],
            'discount_code_id' => ['nullable', 'integer', TenantExists::table('discount_codes')],
            'coupon_type' => ['required', Rule::in(['percentage', 'fixed'])],
            'coupon_value' => ['nullable', 'numeric', 'decimal:0,2', 'gt:0', 'max:100000'],
        ]);
        if ($data['coupon_mode'] === CartRecoverySetting::COUPON_CODE && empty($data['discount_code_id'])) {
            throw ValidationException::withMessages(['discount_code_id' => [__('validation.required', ['attribute' => __('attributes.discount_code_id')])]]);
        }
        if ($data['coupon_mode'] === CartRecoverySetting::COUPON_GENERATED && (empty($data['coupon_value']) || ($data['coupon_type'] === 'percentage' && (float) $data['coupon_value'] > 90))) {
            throw ValidationException::withMessages(['coupon_value' => [__('validation.between.numeric', ['attribute' => __('attributes.coupon_value'), 'min' => 1, 'max' => 90])]]);
        }
        if ($data['coupon_mode'] !== CartRecoverySetting::COUPON_CODE) {
            $data['discount_code_id'] = null;
        }
        $data['coupon_value'] = isset($data['coupon_value']) ? Money::toDecimal(Money::toCents((string) $data['coupon_value'])) : null;
        CartRecoverySetting::current()->fill($data)->save();

        return $this->ok($this->state());
    }

    /**
     * «ابعت تذكير» now: to every lead it can reach (14 days), or to the picked ones. Sent in the background, one send at
     * a time per store; 202 with how many it is going to.
     */
    public function remind(Request $request, Entitlements $entitlements): JsonResponse
    {
        $entitlements->ensure(PlanFeature::AbandonedLeads);
        $data = $request->validate([
            'ids' => ['nullable', 'array', 'max:500'],
            'ids.*' => ['integer', TenantExists::table('abandoned_leads')],
            // «ابعت للكل» on one tab: that kind only.
            'source' => ['nullable', Rule::in(['landing', 'store', 'cart'])],
        ]);
        $source = $data['source'] ?? null;
        $ids = isset($data['ids']) && $data['ids'] !== [] ? array_values(array_unique(array_map('intval', $data['ids']))) : null;
        $count = $this->recovery->manualTargets($ids, $source)->count();
        if ($count === 0) {
            throw new ApiException(422, 'nothing_to_remind', __('recovery.nothing_to_remind'));
        }
        $tenantId = (int) $request->user()->tenant_id;
        if (! Cache::add(SendManualReminders::lockKey($tenantId), true, CartRecovery::MANUAL_LOCK_SECONDS)) {
            throw new ApiException(409, 'reminders_running', __('recovery.reminders_running'));
        }
        SendManualReminders::dispatch($tenantId, $ids, $source);

        return new JsonResponse(['data' => ['count' => $count]], 202);
    }

    public function entries(Request $request): JsonResponse
    {
        $page = MessageWalletEntry::query()->orderByDesc('id')->paginate($this->perPage($request));

        return $this->ok(
            collect($page->items())->map(fn (MessageWalletEntry $e) => [
                'id' => $e->id,
                'type' => $e->type,
                'messages' => $e->messages,
                'balance_after' => $e->balance_after,
                'description' => $e->description,
                'created_at' => $e->created_at->toIso8601ZuluString(),
            ])->all(),
            ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        );
    }

    /** @return array<string, mixed> */
    private function state(): array
    {
        $s = CartRecoverySetting::current();
        $pending = Invoice::query()->where('type', 'message_pack')->whereIn('status', [InvoiceStatus::Open->value, InvoiceStatus::PendingReview->value])->latest('id')->first();

        return [
            // WhatsApp set up and Meta approved the reminder template (emails work regardless).
            'whatsapp_available' => $this->recovery->whatsappAvailable(),
            'enabled' => $s->enabled,
            'whatsapp' => $s->whatsapp,
            'email' => $s->email,
            'first_minutes' => $s->first_minutes,
            'second_hours' => $s->second_hours,
            'coupon_mode' => $s->coupon_mode,
            'discount_code_id' => $s->discount_code_id,
            'coupon_type' => $s->coupon_type,
            'coupon_value' => $s->coupon_value === null ? null : Money::toFloat(Money::toCents((string) $s->coupon_value)),
            'codes' => DiscountCode::query()->where('recovery', false)->where('is_active', true)->latest('id')->limit(50)->get(['id', 'code'])->map(fn (DiscountCode $c) => ['id' => $c->id, 'code' => $c->code])->all(),
            'balance' => (int) (MessageWallet::query()->value('balance') ?? 0),
            'packs' => $this->wallets->packs(),
            'pending' => $pending === null ? null : ['id' => $pending->id, 'number' => $pending->number, 'status' => $pending->status->value, 'messages' => (int) ($pending->snapshot['message_pack']['messages'] ?? 0)],
            'quiet_hours' => ['from' => CartRecovery::QUIET_FROM, 'to' => CartRecovery::QUIET_TO],
            'stats' => $this->recovery->stats(),
        ];
    }
}
