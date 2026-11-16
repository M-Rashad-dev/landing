<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Laravel\Sanctum\Sanctum;

/** The messages a merchant reads must never show a raw field key ("category_ids.0", "rates.0.fee"). */
function noRawKeys(array $errors): void
{
    foreach ($errors as $field => $messages) {
        foreach ($messages as $message) {
            expect(preg_match('/[a-z]+_[a-z_]+|\b[a-z]+\.\d+/', $message))->toBe(0, "{$field}: {$message}");
        }
    }
}

it('names nested and unnamed fields in Arabic', function () {
    $errors = Validator::make(
        ['rates' => [['fee' => 'x']], 'category_ids' => ['a'], 'draft' => ['settings' => ['colors' => ['primary' => 5]]], 'zz_unknown_key' => 'x'],
        ['rates.*.fee' => 'numeric', 'category_ids.*' => 'integer', 'draft.settings.colors.primary' => 'string', 'zz_unknown_key' => 'integer'],
    )->errors()->toArray();

    expect($errors['rates.0.fee'][0])->toContain('الرسوم')
        ->and($errors['category_ids.0'][0])->toContain('التصنيفات')
        ->and($errors['draft.settings.colors.primary'][0])->toContain('اللون الأساسي')
        ->and($errors['zz_unknown_key'][0])->toContain(__('validation.this_field'));
    noRawKeys($errors);
});

it('answers dashboard forms in plain Arabic', function () {
    actingAsOwner();

    noRawKeys($this->postJson('/api/v1/dashboard/shipping-companies', ['name' => 'x', 'default_fee' => -1, 'rates' => [['governorate' => 'Mars', 'fee' => 'abc', 'is_available' => 'maybe']]])->assertStatus(422)->json('errors'));
    noRawKeys($this->postJson('/api/v1/dashboard/offers', ['type' => 'percentage', 'applies_to' => 'categories', 'category_ids' => [999999]])->assertStatus(422)->json('errors'));
    noRawKeys($this->postJson('/api/v1/dashboard/products', ['name' => '', 'price' => 'free', 'category_id' => 999999])->assertStatus(422)->json('errors'));
    noRawKeys($this->post('/api/v1/dashboard/billing/checkout', ['type' => 'subscription', 'plan_key' => 'pro', 'period' => 'monthly', 'method' => 'instapay'], ['Accept' => 'application/json'])->assertStatus(422)->json('errors'));
});

it('answers admin forms in plain Arabic', function () {
    Sanctum::actingAs(User::factory()->superAdmin()->create());

    noRawKeys($this->putJson('/api/v1/admin/alerts', ['channel' => 'sms', 'phone' => '1', 'email' => 'x', 'events' => ['nope']])->assertStatus(422)->json('errors'));
    noRawKeys($this->putJson('/api/v1/admin/plans/pro', ['prices' => ['monthly' => ['price' => 'abc', 'discount_percent' => 500]]])->assertStatus(422)->json('errors'));
});
