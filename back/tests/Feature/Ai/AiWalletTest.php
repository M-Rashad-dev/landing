<?php

declare(strict_types=1);

use App\Actions\Auth\RegisterTenant;
use App\Ai\Ai;
use App\Ai\AiClient;
use App\Ai\AiError;
use App\Ai\AiUnavailable;
use App\Ai\AiWallets;
use App\Billing\PlanCatalog;
use App\Billing\PlatformSettings;
use App\Exceptions\ApiException;
use App\Models\AdminAuditLog;
use App\Models\AiUsage;
use App\Models\AiWalletEntry;
use App\Models\PaymentMethod;
use App\Models\PlanFeatureValue;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserNotification;
use App\Tenancy\Tenancy;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Storage::fake('local');
    PaymentMethod::query()->whereKey('instapay')->update(['is_active' => true, 'account_value' => 'platform@instapay']);
    // The dollar at 50 EGP, a 10% margin: $0.01 → 0.55 EGP.
    app(PlatformSettings::class)->save(['ai_features' => ['support' => true], 'ai_usd_rate' => 50, 'ai_margin_percent' => 10, 'ai_welcome_credit' => 10, 'ai_low_balance' => 10]);
});

/** The AI feature on the Pro plan (the owner's plan settings). */
function aiOnPro(): void
{
    PlanFeatureValue::query()->updateOrCreate(['plan_key' => 'pro', 'entitlement' => 'ai'], ['value' => 1]);
    PlanCatalog::flush();
}

function walletOwner(string $plan = 'pro'): User
{
    $tenant = Tenant::factory()->onPlan($plan)->create();
    $user = User::factory()->for($tenant)->create();
    Sanctum::actingAs($user->fresh(['tenant']));

    return $user;
}

function wallets(): AiWallets
{
    return app(AiWallets::class);
}

function usageOf(int $tenantId, float $usd): AiUsage
{
    return AiUsage::query()->create(['tenant_id' => $tenantId, 'feature' => 'sections', 'model' => 'qwen4-max', 'cost_usd' => $usd]);
}

function balance(int $tenantId): array
{
    $w = wallets()->wallet($tenantId);

    return [$w->freeCents(), $w->paidCents()];
}

function topUp(int $amount)
{
    return test()->post('/api/v1/dashboard/billing/checkout', [
        'type' => 'ai_credit', 'amount' => $amount, 'method' => 'instapay', 'sender_ref' => 'TX-112233',
        'receipt' => UploadedFile::fake()->image('receipt.jpg', 600, 900),
    ], ['Accept' => 'application/json']);
}

it('gives a new store the welcome credit once, on any plan', function () {
    $reg = app(RegisterTenant::class)->handle(['name' => 'منى', 'email' => 'mona@example.com', 'phone' => '+201055500011', 'store_name' => 'متجر منى', 'password' => 'secret-pass-123']);
    $tenant = $reg['tenant'];

    expect(balance($tenant->id))->toBe([1000, 0]);
    wallets()->welcome($tenant);
    expect(balance($tenant->id))->toBe([1000, 0])
        ->and(Tenancy::runAs($tenant->id, fn () => AiWalletEntry::query()->pluck('type')->all()))->toBe(['welcome']);
});

it('charges the real cost × the dollar × the margin, rounded up to the piaster, free pot first, once per call', function () {
    aiOnPro();
    $tenant = walletOwner()->tenant;
    wallets()->credit($tenant, 50, 'gift', 'هدية');
    wallets()->credit($tenant, 1000, 'topup');

    $usage = usageOf($tenant->id, 0.01);
    $entry = wallets()->charge($tenant, $usage, 'sections', 'سيكشن');
    expect($entry->amount)->toBe('-0.55')
        ->and(balance($tenant->id))->toBe([0, 995])
        ->and($usage->refresh()->charged_egp)->toBe('0.55');

    // Charged once even if asked again.
    wallets()->charge($tenant, $usage, 'sections', 'سيكشن');
    expect(balance($tenant->id))->toBe([0, 995]);

    // A fraction of a piaster costs a whole one.
    wallets()->charge($tenant, usageOf($tenant->id, 0.0001), 'sections', 'سيكشن صغير');
    expect(balance($tenant->id))->toBe([0, 994]);
});

it('spends only the free pot on a plan without the AI, going below zero for a call already made', function () {
    $tenant = walletOwner('basic')->tenant;
    wallets()->credit($tenant, 30, 'gift');
    wallets()->credit($tenant, 500, 'topup');

    wallets()->charge($tenant, usageOf($tenant->id, 0.01), 'sections', 'سيكشن');

    expect(balance($tenant->id))->toBe([-25, 500])
        ->and(wallets()->spendableCents($tenant))->toBe(0);
});

it('refuses an AI action it cannot price, a plan without the AI, or a balance too low', function () {
    $tenant = walletOwner('basic')->tenant;
    $code = function (callable $call): string {
        try {
            $call();
        } catch (ApiException $e) {
            return $e->errorCode;
        }

        return 'none';
    };

    app(PlatformSettings::class)->save(['ai_usd_rate' => null]);
    expect($code(fn () => wallets()->ensureCanSpend($tenant, 0.01)))->toBe('ai_unavailable');

    app(PlatformSettings::class)->save(['ai_usd_rate' => 50]);
    expect($code(fn () => wallets()->ensureCanSpend($tenant, 0.01)))->toBe('plan_feature_locked');

    wallets()->credit($tenant, 20, 'gift');
    expect($code(fn () => wallets()->ensureCanSpend($tenant, 0.01)))->toBe('ai_balance_low');
    wallets()->credit($tenant, 100, 'gift');
    expect($code(fn () => wallets()->ensureCanSpend($tenant, 0.01)))->toBe('none');
});

it('charges a paid AI call after it answers, and nothing when it fails', function () {
    aiOnPro();
    $tenant = walletOwner()->tenant;
    wallets()->credit($tenant, 10000, 'topup');
    $messages = [['role' => 'user', 'content' => 'اعملي سيكشن']];
    app(AiClient::class)->answer('<section>…</section>', new AiError('Qwen 500'));

    app(Ai::class)->chatPaid($tenant, 'support', 'support', $messages, ['max_tokens' => 500], 'سيكشن عرض التصنيفات');
    $charged = Tenancy::runAs($tenant->id, fn () => AiWalletEntry::query()->where('type', 'charge')->sole());
    expect($charged->description)->toBe('سيكشن عرض التصنيفات')
        ->and(AiUsage::query()->latest('id')->value('charged_egp'))->not->toBeNull();

    $left = balance($tenant->id);
    expect(fn () => app(Ai::class)->chatPaid($tenant, 'support', 'support', $messages, ['max_tokens' => 500], 'تاني'))->toThrow(AiUnavailable::class);
    expect(balance($tenant->id))->toBe($left);
});

it('tells the merchant once when the balance gets low, again after a top-up', function () {
    aiOnPro();
    $owner = walletOwner();
    $tenant = $owner->tenant;
    wallets()->credit($tenant, 1100, 'topup');

    wallets()->charge($tenant, usageOf($tenant->id, 0.01), 'sections', 'أ');   // 10.45 left: above the line
    wallets()->charge($tenant, usageOf($tenant->id, 0.01), 'sections', 'ب');   // 9.90: under it
    wallets()->charge($tenant, usageOf($tenant->id, 0.01), 'sections', 'ج');
    $told = fn () => UserNotification::query()->where('user_id', $owner->id)->where('event', 'ai_low_balance')->count();
    expect($told())->toBe(1);

    wallets()->credit($tenant, 100, 'topup');
    wallets()->charge($tenant, usageOf($tenant->id, 0.01), 'sections', 'د');
    expect($told())->toBe(2);
});

it('tops up through a receipt the owner approves, with the offer it reaches', function () {
    aiOnPro();
    app(PlatformSettings::class)->save(['ai_topup_offers' => [['min' => 500, 'bonus' => 25], ['min' => 1000, 'bonus' => 100]]]);
    $tenant = walletOwner()->tenant;

    $this->postJson('/api/v1/dashboard/billing/checkout/preview', ['type' => 'ai_credit', 'amount' => 500])->assertOk()
        ->assertJsonPath('data.total', 500)->assertJsonPath('data.ai_credit.bonus', 25);
    $invoice = topUp(500)->assertCreated()->json('data');
    topUp(250)->assertStatus(422)->assertJsonPath('code', 'invoice_pending_review');

    Sanctum::actingAs(User::factory()->superAdmin()->create());
    $payment = $invoice['payments'][0]['id'];
    $this->postJson("/api/v1/admin/payments/{$payment}/approve")->assertOk();

    expect(balance($tenant->id))->toBe([0, 50000 + 2500])
        ->and(Tenancy::runAs($tenant->id, fn () => AiWalletEntry::query()->orderBy('id')->pluck('type')->all()))->toBe(['topup', 'bonus']);
});

it('refuses a top-up on a plan without the AI, or under the least amount', function () {
    walletOwner();
    $this->postJson('/api/v1/dashboard/billing/checkout/preview', ['type' => 'ai_credit', 'amount' => 100])->assertForbidden()->assertJsonPath('code', 'plan_feature_locked');

    aiOnPro();
    $this->postJson('/api/v1/dashboard/billing/checkout/preview', ['type' => 'ai_credit', 'amount' => 30])->assertStatus(422)->assertJsonValidationErrors(['amount']);
    $this->postJson('/api/v1/dashboard/billing/checkout/preview', ['type' => 'ai_credit'])->assertStatus(422)->assertJsonValidationErrors(['amount']);
    $this->postJson('/api/v1/dashboard/billing/checkout/preview', ['type' => 'ai_credit', 'amount' => 75])->assertOk();
});

it('shows the store its balance, packages and moves, and nothing of another store', function () {
    $this->getJson('/api/v1/dashboard/ai/wallet')->assertUnauthorized();
    aiOnPro();
    $tenant = walletOwner()->tenant;
    wallets()->credit($tenant, 1000, 'gift', 'هدية');
    wallets()->charge($tenant, usageOf($tenant->id, 0.01), 'sections', 'سيكشن');
    $other = Tenant::factory()->onPlan('pro')->create();
    wallets()->credit($other, 99900, 'gift', 'متجر تاني');

    $this->getJson('/api/v1/dashboard/ai/wallet')->assertOk()
        ->assertJsonPath('data.balance', 9.45)
        ->assertJsonPath('data.paid_allowed', true)
        ->assertJsonPath('data.packages', [100, 250, 500, 1000])
        ->assertJsonPath('data.month.spent', 0.55);
    $this->getJson('/api/v1/dashboard/ai/wallet/entries?type=gift')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.description', 'هدية');
    $this->getJson('/api/v1/dashboard/ai/wallet/entries?type=nope')->assertStatus(422);
});

it('lets the owner give or take back balance with a reason, logged', function () {
    $tenant = walletOwner('basic')->tenant;
    $this->postJson("/api/v1/admin/tenants/{$tenant->id}/ai-wallet", ['action' => 'gift', 'amount' => 5, 'reason' => 'x'])->assertForbidden();

    Sanctum::actingAs(User::factory()->superAdmin()->create());
    $this->postJson("/api/v1/admin/tenants/{$tenant->id}/ai-wallet", ['action' => 'gift', 'amount' => 25.5, 'reason' => 'تعويض'])->assertOk()->assertJsonPath('data.free', 25.5);
    $this->postJson("/api/v1/admin/tenants/{$tenant->id}/ai-wallet", ['action' => 'deduct', 'amount' => 100, 'reason' => 'غلطة'])->assertOk()->assertJsonPath('data.balance', 0);
    $this->postJson("/api/v1/admin/tenants/{$tenant->id}/ai-wallet", ['action' => 'steal', 'amount' => 0, 'reason' => ''])->assertStatus(422)->assertJsonValidationErrors(['action', 'amount', 'reason']);
    $this->getJson('/api/v1/admin/tenants/999999/ai-wallet')->assertNotFound();
    $this->getJson("/api/v1/admin/tenants/{$tenant->id}/ai-wallet")->assertOk()->assertJsonCount(2, 'data.entries');

    expect(AdminAuditLog::query()->where('action', 'ai.wallet.gift')->count())->toBe(1);
});

it('saves the balance settings and refuses wrong ones', function () {
    Sanctum::actingAs(User::factory()->superAdmin()->create());
    $base = ['features' => ['support' => false], 'daily_cap_usd' => 20, 'usd_rate' => 50, 'margin_percent' => 10, 'support_daily_messages' => 30];

    $this->putJson('/api/v1/admin/ai/settings', $base + ['topup_packages' => [200, 100], 'topup_min' => 60, 'topup_offers' => [['min' => 1000, 'bonus' => 50]], 'welcome_credit' => 15, 'low_balance' => 5])
        ->assertOk()->assertJsonPath('data.settings.topup_packages', [100, 200])->assertJsonPath('data.settings.topup_offers.0.bonus', 50)->assertJsonPath('data.settings.welcome_credit', 15);
    $this->putJson('/api/v1/admin/ai/settings', $base + ['topup_packages' => [], 'topup_min' => 0, 'topup_offers' => [['min' => 0]], 'welcome_credit' => -1, 'low_balance' => 'x'])
        ->assertStatus(422)->assertJsonValidationErrors(['topup_packages', 'topup_min', 'topup_offers.0.min', 'topup_offers.0.bonus', 'welcome_credit', 'low_balance']);
});
