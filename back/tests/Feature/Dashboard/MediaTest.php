<?php

declare(strict_types=1);

use App\Models\Identity;
use App\Models\Media;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
    $this->user = actingAsOwner();
});

function upload(array $files, array $extra = [])
{
    return test()->post('/api/v1/dashboard/media', array_merge(['files' => $files], $extra), ['Accept' => 'application/json']);
}

it('uploads an image and stores three webp variants', function () {
    $response = upload([UploadedFile::fake()->image('photo.jpg', 2400, 1600)]);

    $response->assertCreated()
        ->assertJsonPath('data.0.name', 'photo.jpg')
        ->assertJsonPath('data.0.width', 2400)
        ->assertJsonStructure(['data' => [['id', 'urls' => ['thumb', 'medium', 'large'], 'size']]]);

    $media = asTenant($this->user, fn () => Media::query()->firstOrFail());
    expect(array_keys($media->variants))->toBe(['thumb', 'medium', 'large'])
        ->and($media->variants['large'])->toStartWith("tenants/{$this->user->tenant_id}/")
        ->and($media->variants['large'])->not->toContain('photo');

    foreach ($media->variants as $path) {
        Storage::disk('public')->assertExists($path);
    }

    [$w] = getimagesizefromstring(Storage::disk('public')->get($media->variants['thumb']));
    expect($w)->toBe(320);
    expect($response->json('data.0.urls.large'))->toBe('/media/'.$media->variants['large']);
});

it('never upscales small images', function () {
    upload([UploadedFile::fake()->image('small.png', 200, 100)])->assertCreated();

    $media = asTenant($this->user, fn () => Media::query()->firstOrFail());
    [$w] = getimagesizefromstring(Storage::disk('public')->get($media->variants['large']));
    expect($w)->toBe(200);
});

it('creates favicon icons', function () {
    upload([UploadedFile::fake()->image('icon.png', 512, 400)], ['purpose' => 'favicon'])->assertCreated();

    $media = asTenant($this->user, fn () => Media::query()->firstOrFail());
    expect($media->variants)->toHaveKeys(['icon32', 'icon180']);
    [$w, $h] = getimagesizefromstring(Storage::disk('public')->get($media->variants['icon180']));
    expect([$w, $h])->toBe([180, 180]);
});

it('rejects a php file disguised as an image', function () {
    upload([UploadedFile::fake()->createWithContent('shell.jpg', '<?php system($_GET["c"]); ?>')])
        ->assertStatus(422)
        ->assertJsonValidationErrors('files.0');

    expect(Storage::disk('public')->allFiles())->toBe([]);
});

it('rejects svg and gif', function (UploadedFile $file) {
    upload([$file])->assertStatus(422)->assertJsonValidationErrors('files.0');
})->with([
    'svg' => fn () => UploadedFile::fake()->createWithContent('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    'gif' => fn () => UploadedFile::fake()->image('anim.gif', 100, 100),
]);

it('rejects files over 5MB', function () {
    upload([UploadedFile::fake()->create('big.jpg', 6000, 'image/jpeg')])
        ->assertStatus(422)
        ->assertJsonValidationErrors('files.0');
});

it('rejects images narrower than 16px', function () {
    upload([UploadedFile::fake()->image('tiny.png', 10, 10)])->assertStatus(422);
});

it('keeps nothing when one file of a batch fails', function () {
    upload([
        UploadedFile::fake()->image('ok.jpg', 400, 300),
        UploadedFile::fake()->createWithContent('bad.jpg', 'not an image'),
    ])->assertStatus(422)->assertJsonValidationErrors('files.1');

    expect(asTenant($this->user, fn () => Media::query()->count()))->toBe(0)
        ->and(Storage::disk('public')->allFiles())->toBe([]);
});

it('limits files per request to 10', function () {
    $files = array_map(fn ($i) => UploadedFile::fake()->image("p{$i}.jpg", 50, 50), range(1, 11));

    upload($files)->assertStatus(422)->assertJsonValidationErrors('files');
});

it('enforces the per-tenant media limit', function () {
    config(['landing.limits.media' => 1]);
    upload([UploadedFile::fake()->image('a.jpg', 50, 50)])->assertCreated();

    upload([UploadedFile::fake()->image('b.jpg', 50, 50)])->assertStatus(422)->assertJsonPath('code', 'limit_reached');
});

it('lists newest first with search and pagination', function () {
    asTenant($this->user, function () {
        Media::factory()->create(['original_name' => 'shirt-front.jpg']);
        Media::factory()->create(['original_name' => 'banner.png', 'alt' => 'تيشيرت أبيض']);
    });

    $this->getJson('/api/v1/dashboard/media')
        ->assertOk()
        ->assertJsonPath('data.0.name', 'banner.png')
        ->assertJsonPath('meta.total', 2);

    $this->getJson('/api/v1/dashboard/media?q=shirt')->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/dashboard/media?q=تيشيرت')->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/dashboard/media?per_page=1')->assertJsonPath('meta.last_page', 2);
});

it('resolves media by ids within the tenant only', function () {
    [$a, $b] = asTenant($this->user, fn () => [Media::factory()->create(), Media::factory()->create()]);
    $foreign = Media::factory()->create();

    $ids = collect($this->getJson("/api/v1/dashboard/media?ids={$a->id},{$b->id},{$foreign->id}")->assertOk()->json('data'))->pluck('id')->sort()->values()->all();

    expect($ids)->toBe([$a->id, $b->id]);
});

it('updates alt text and strips html', function () {
    $media = asTenant($this->user, fn () => Media::factory()->create());

    $this->patchJson("/api/v1/dashboard/media/{$media->id}", ['alt' => '<b>صورة</b> المنتج'])
        ->assertOk()
        ->assertJsonPath('data.alt', 'صورة المنتج');
});

it('refuses to delete media used by an identity and lists the usage', function () {
    $media = asTenant($this->user, fn () => Media::factory()->create());
    asTenant($this->user, fn () => Identity::factory()->create(['name' => 'هوية أ', 'logo_media_id' => $media->id]));

    $this->deleteJson("/api/v1/dashboard/media/{$media->id}")
        ->assertStatus(409)
        ->assertJsonPath('code', 'media_in_use')
        ->assertJsonPath('usages.0.type', 'identity_logo')
        ->assertJsonPath('usages.0.name', 'هوية أ');
});

it('deletes unused media and its files', function () {
    upload([UploadedFile::fake()->image('x.jpg', 400, 300)])->assertCreated();
    $media = asTenant($this->user, fn () => Media::query()->firstOrFail());

    $this->deleteJson("/api/v1/dashboard/media/{$media->id}")->assertNoContent();

    expect(Storage::disk('public')->allFiles())->toBe([])
        ->and(asTenant($this->user, fn () => Media::query()->count()))->toBe(0);
});

it('requires authentication', function () {
    app('auth')->forgetGuards();
    $this->refreshApplication();

    $this->getJson('/api/v1/dashboard/media')->assertUnauthorized();
});
