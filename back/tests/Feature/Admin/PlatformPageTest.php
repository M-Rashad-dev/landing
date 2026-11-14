<?php

declare(strict_types=1);

use App\Jobs\RevalidateFrontendTags;
use App\Models\AdminAuditLog;
use App\Models\PlatformPage;
use App\Models\User;
use App\Services\FrontendRevalidator;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;

it('ships every platform page with starting text', function () {
    expect(PlatformPage::query()->orderBy('sort_order')->pluck('slug')->all())->toBe(PlatformPage::SLUGS);
    expect(PlatformPage::query()->where('body', '')->exists())->toBeFalse();
});

it('serves the published pages on the platform domain, hides unpublished ones', function () {
    PlatformPage::query()->where('slug', 'acceptable-use')->update(['is_published' => false]);

    $list = $this->getJson('/api/v1/platform-pages')->assertOk()->json('data');
    expect(array_column($list, 'slug'))->toBe(['about', 'terms', 'privacy', 'refund-policy']);

    $this->getJson('/api/v1/platform-pages/terms')->assertOk()
        ->assertJsonPath('data.title', 'شروط الاستخدام')
        ->assertJsonStructure(['data' => ['slug', 'title', 'summary', 'body', 'updated_at']]);
    $this->getJson('/api/v1/platform-pages/acceptable-use')->assertNotFound();
    $this->getJson('/api/v1/platform-pages/nope')->assertNotFound();
});

it('lets the super admin edit a page: text, summary, visibility, logged and refreshed on the site', function () {
    Queue::fake();
    $admin = User::factory()->superAdmin()->create(['name' => 'المدير']);
    Sanctum::actingAs($admin);

    $this->getJson('/api/v1/admin/platform-pages')->assertOk()
        ->assertJsonCount(count(PlatformPage::SLUGS), 'data')
        ->assertJsonMissingPath('data.0.body');
    $this->getJson('/api/v1/admin/platform-pages/privacy')->assertOk()->assertJsonPath('data.slug', 'privacy');

    $this->putJson('/api/v1/admin/platform-pages/privacy', [
        'title' => '<b>سياسة الخصوصية</b>',
        'summary' => 'ملخص جديد',
        'body' => "## بياناتك\r\n\r\nنص جديد للسياسة <script>x</script> بالتفصيل.",
        'is_published' => false,
    ])->assertOk()
        ->assertJsonPath('data.title', 'سياسة الخصوصية')
        ->assertJsonPath('data.is_published', false)
        ->assertJsonPath('data.updated_by', 'المدير')
        ->assertJsonPath('data.body', "## بياناتك\n\nنص جديد للسياسة <script>x</script> بالتفصيل.");

    expect(AdminAuditLog::query()->where('action', 'platform_page.update')->where('target_id', 'privacy')->exists())->toBeTrue();
    Queue::assertPushed(RevalidateFrontendTags::class, fn ($job) => $job->tags === ['platform-pages']);
    $this->getJson('/api/v1/platform-pages/privacy')->assertNotFound();
});

it('validates the page fields', function () {
    Sanctum::actingAs(User::factory()->superAdmin()->create());

    $this->putJson('/api/v1/admin/platform-pages/terms', ['title' => '', 'body' => 'قصير', 'is_published' => 'x'])
        ->assertStatus(422)->assertJsonValidationErrors(['title', 'body', 'is_published']);
    $this->putJson('/api/v1/admin/platform-pages/unknown', ['title' => 'عنوان', 'body' => str_repeat('نص ', 20), 'is_published' => true])->assertNotFound();
});

it('keeps the editor to the super admin', function () {
    $this->getJson('/api/v1/admin/platform-pages')->assertUnauthorized();

    $owner = createOwner();
    Sanctum::actingAs($owner);
    $this->getJson('/api/v1/admin/platform-pages')->assertForbidden();
    $this->putJson('/api/v1/admin/platform-pages/terms', ['title' => 'x', 'body' => str_repeat('x', 30), 'is_published' => true])->assertForbidden();
});

it('purges platform-wide tags on the front', function () {
    config(['landing.front_internal_url' => 'http://next.test', 'landing.revalidate_secret' => 'secret']);
    Http::fake(['next.test/*' => Http::response(['revalidated' => 1])]);

    app(FrontendRevalidator::class)->revalidateTags(['platform-pages', 'platform-pages']);

    Http::assertSent(fn ($request) => $request->url() === 'http://next.test/api/revalidate' && $request['tags'] === ['platform-pages']);
});
