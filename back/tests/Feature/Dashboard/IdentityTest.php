<?php

declare(strict_types=1);

use App\Models\Identity;
use App\Models\Media;
use App\Models\Tenant;
use App\Models\User;

function identityPayload(array $overrides = []): array
{
    return array_replace_recursive([
        'name' => 'الهوية الرئيسية',
        'brand_name' => 'متجر رشاد',
        'logo_media_id' => null,
        'favicon_media_id' => null,
        'og_image_media_id' => null,
        'colors' => [
            'primary' => '#7c3aed', 'secondary' => '#F5F3FF', 'accent' => '#F59E0B', 'background' => '#FFFFFF',
            'foreground' => '#111827', 'muted' => '#6B7280', 'border' => '#E5E7EB',
        ],
        'font_heading' => 'tajawal',
        'font_body' => 'cairo',
        'button_radius' => 'full',
        'seo_title' => 'أفضل تيشيرت',
        'seo_description' => 'وصف قصير',
        'contact' => ['phone' => '01012345678', 'whatsapp' => '+20 111 234 5678', 'email' => 'Shop@Example.com', 'address' => 'القاهرة'],
        'socials' => ['facebook' => 'https://facebook.com/shop', 'instagram' => 'https://www.instagram.com/shop'],
        'tracking' => [
            'meta_pixel_id' => '123456789012345',
            'tiktok_pixel_id' => 'c1abcdefghijklmnop',
            'ga4_id' => 'g-abc123xyz',
            'gtm_id' => 'GTM-AB12CD',
            'snapchat_pixel_id' => '1B2C3D4E-1234-5678-9ABC-DEF012345678',
            'google_site_verification' => 'abc_DEF-123456',
            'facebook_domain_verification' => 'abcdefghijklmnop123',
            'conversion_event' => 'Purchase',
        ],
    ], $overrides);
}

beforeEach(function () {
    $this->user = actingAsOwner();
});

it('creates an identity with normalized values', function () {
    $response = $this->postJson('/api/v1/dashboard/identities', identityPayload());

    $response->assertCreated()
        ->assertJsonPath('data.colors.primary', '#7C3AED')
        ->assertJsonPath('data.contact.phone', '+201012345678')
        ->assertJsonPath('data.contact.whatsapp', '+201112345678')
        ->assertJsonPath('data.contact.email', 'shop@example.com')
        ->assertJsonPath('data.tracking.ga4_id', 'G-ABC123XYZ')
        ->assertJsonPath('data.tracking.tiktok_pixel_id', 'C1ABCDEFGHIJKLMNOP')
        ->assertJsonPath('data.tracking.snapchat_pixel_id', '1b2c3d4e-1234-5678-9abc-def012345678')
        ->assertJsonPath('data.tracking.conversion_event', 'Purchase')
        ->assertJsonPath('data.colors.primary_foreground', '#FFFFFF');
});

it('makes the first identity of a tenant the default', function () {
    $tenant = Tenant::factory()->create();
    $owner = User::factory()->for($tenant)->create();
    actingAsOwner($owner->fresh('tenant'));

    $this->postJson('/api/v1/dashboard/identities', identityPayload())->assertJsonPath('data.is_default', true);
    $this->postJson('/api/v1/dashboard/identities', identityPayload(['name' => 'ثانية']))->assertJsonPath('data.is_default', false);
});

it('validates required fields, colors, fonts and radius', function () {
    $this->postJson('/api/v1/dashboard/identities', identityPayload([
        'name' => '',
        'colors' => ['primary' => 'red', 'background' => '#FFF'],
        'font_heading' => 'comic_sans',
        'button_radius' => 'huge',
    ]))->assertStatus(422)->assertJsonValidationErrors([
        'name', 'colors.primary', 'colors.background', 'font_heading', 'button_radius',
    ]);
});

it('accepts every valid tracking format', function (string $key, string $value) {
    $this->postJson('/api/v1/dashboard/identities', identityPayload(['tracking' => [$key => $value]]))->assertCreated();
})->with([
    ['meta_pixel_id', '1234567890'],
    ['meta_pixel_id', '12345678901234567890'],
    ['tiktok_pixel_id', 'CABCDEFGHIJ1234'],
    ['ga4_id', 'G-ABCDEF'],
    ['ga4_id', 'G-ABCDEFGHIJ1234'],
    ['gtm_id', 'GTM-ABCD'],
    ['gtm_id', 'GTM-ABCDEFGH12'],
    ['snapchat_pixel_id', '0f8fad5b-d9cb-469f-a165-70867728950e'],
    ['google_site_verification', 'aB3_-xYz9QwErTy'],
    ['facebook_domain_verification', 'abcdef1234567890'],
]);

it('rejects invalid or injected tracking values', function (string $key, string $value) {
    $this->postJson('/api/v1/dashboard/identities', identityPayload(['tracking' => [$key => $value]]))
        ->assertStatus(422)
        ->assertJsonValidationErrors("tracking.{$key}");
})->with([
    ['meta_pixel_id', '123'],
    ['meta_pixel_id', '1234567890abc'],
    ['meta_pixel_id', '"><script>alert(1)</script>'],
    ['tiktok_pixel_id', 'short'],
    ['tiktok_pixel_id', "C123456789');alert(1);//"],
    ['ga4_id', 'UA-12345-1'],
    ['ga4_id', 'G-ABC'],
    ['gtm_id', 'GTM-AB'],
    ['gtm_id', 'GTM-ABCD<script>'],
    ['snapchat_pixel_id', 'not-a-uuid'],
    ['google_site_verification', 'short'],
    ['google_site_verification', 'abc"><meta http-equiv="refresh">'],
    ['facebook_domain_verification', 'has spaces in it ok'],
    ['conversion_event', 'AddToCart'],
]);

it('validates contact and social links', function () {
    $this->postJson('/api/v1/dashboard/identities', identityPayload([
        'contact' => ['phone' => '123', 'email' => 'not-an-email'],
        'socials' => [
            'facebook' => 'http://facebook.com/shop',
            'instagram' => 'https://evil.com/instagram.com',
            'tiktok' => 'javascript:alert(1)',
            'youtube' => 'https://youtube.com.evil.com/x',
        ],
    ]))->assertStatus(422)->assertJsonValidationErrors([
        'contact.phone', 'contact.email', 'socials.facebook', 'socials.instagram', 'socials.tiktok', 'socials.youtube',
    ]);
});

it('accepts social links on sub-domains and alternative hosts', function () {
    $this->postJson('/api/v1/dashboard/identities', identityPayload(['socials' => [
        'facebook' => 'https://m.facebook.com/shop',
        'youtube' => 'https://youtu.be/abc',
        'x' => 'https://twitter.com/shop',
        'snapchat' => 'https://www.snapchat.com/add/shop',
        'tiktok' => 'https://www.tiktok.com/@shop',
    ]]))->assertCreated();
});

it('strips html from text fields', function () {
    $this->postJson('/api/v1/dashboard/identities', identityPayload(['brand_name' => '<script>x</script>متجر']))
        ->assertCreated()
        ->assertJsonPath('data.brand_name', 'xمتجر');
});

it('links media of the same tenant only', function () {
    $mine = asTenant($this->user, fn () => Media::factory()->create());
    $other = Media::factory()->create();

    $this->postJson('/api/v1/dashboard/identities', identityPayload(['logo_media_id' => $mine->id]))
        ->assertCreated()
        ->assertJsonPath('data.logo.id', $mine->id);

    $this->postJson('/api/v1/dashboard/identities', identityPayload(['logo_media_id' => $other->id]))
        ->assertStatus(422)
        ->assertJsonValidationErrors('logo_media_id');
});

it('updates an identity', function () {
    $identity = asTenant($this->user, fn () => Identity::factory()->create());

    $this->putJson("/api/v1/dashboard/identities/{$identity->id}", identityPayload(['name' => 'معدلة']))
        ->assertOk()
        ->assertJsonPath('data.name', 'معدلة');
});

it('switches the default identity', function () {
    [$first, $second] = asTenant($this->user, fn () => [
        Identity::factory()->default()->create(),
        Identity::factory()->create(),
    ]);

    $this->postJson("/api/v1/dashboard/identities/{$second->id}/make-default")->assertOk()->assertJsonPath('data.is_default', true);

    expect($first->fresh()->is_default)->toBeFalse()
        ->and(asTenant($this->user, fn () => Identity::query()->where('is_default', true)->count()))->toBe(1);
});

it('refuses to delete the default identity', function () {
    $identity = asTenant($this->user, fn () => Identity::factory()->default()->create());

    $this->deleteJson("/api/v1/dashboard/identities/{$identity->id}")
        ->assertStatus(409)
        ->assertJsonPath('code', 'identity_is_default');
});

it('soft deletes a non-default identity', function () {
    $identity = asTenant($this->user, fn () => Identity::factory()->create());

    $this->deleteJson("/api/v1/dashboard/identities/{$identity->id}")->assertNoContent();
    $this->getJson("/api/v1/dashboard/identities/{$identity->id}")->assertNotFound();
    expect(Identity::withTrashed()->withoutGlobalScopes()->find($identity->id)?->trashed())->toBeTrue();
});

it('creates a default identity on registration', function () {
    app('auth')->forgetGuards();

    $this->postJson('/api/v1/auth/register', [
        'name' => 'محمد', 'email' => 'new@example.com', 'phone' => '01099999999',
        'store_name' => 'متجر جديد', 'password' => 'secret-pass-1', 'password_confirmation' => 'secret-pass-1',
    ])->assertCreated();

    $tenant = Tenant::query()->where('name', 'متجر جديد')->firstOrFail();
    $identity = asTenant($tenant, fn () => Identity::query()->firstOrFail());

    expect($identity->is_default)->toBeTrue()
        ->and($identity->brand_name)->toBe('متجر جديد')
        ->and($identity->font_heading)->toBe('cairo')
        ->and($identity->button_radius)->toBe('md');
});
