<?php

declare(strict_types=1);

use App\Enums\OrderStatus;
use App\Enums\PageStatus;
use App\Models\Domain;
use App\Models\LandingPage;
use App\Models\Order;
use App\Models\User;
use Database\Seeders\DemoSeeder;

it('builds a full demo store through the real actions, once', function () {
    $this->artisan('platform:demo')->assertSuccessful();
    $this->artisan('platform:demo')->assertSuccessful();

    $owner = User::query()->where('email', DemoSeeder::OWNER_EMAIL)->firstOrFail();
    expect(User::query()->where('email', DemoSeeder::OWNER_EMAIL)->count())->toBe(1)
        ->and(User::query()->where('email', DemoSeeder::ADMIN_EMAIL)->firstOrFail()->isSuperAdmin())->toBeTrue();

    asTenant($owner, function () {
        $pages = LandingPage::query()->get();
        expect($pages)->toHaveCount(2)
            ->and($pages->every(fn (LandingPage $p) => $p->status === PageStatus::Published))->toBeTrue()
            ->and($pages->pluck('theme_key')->sort()->values()->all())->toBe(['celia', 'malak'])
            ->and($pages->firstWhere('is_home', true)?->slug)->toBe('smart-watch');

        $orders = Order::query()->get();
        expect($orders)->toHaveCount(24)
            ->and($orders->pluck('status')->unique()->count())->toBe(count(OrderStatus::cases()))
            ->and($orders->min('created_at')->lt(now()->subDays(10)))->toBeTrue()
            ->and($orders->whereNotNull('discount_code')->count())->toBeGreaterThan(0);
    });

    // The demo site answers through the public API.
    $host = asTenant($owner, fn () => Domain::query()->value('host'));
    $this->getJson('/api/v1/public/pages?host='.$host.'&slug=', internalHeaders())->assertOk()->assertJsonPath('data.page.slug', 'smart-watch');
});

it('refuses to run in production', function () {
    app()->detectEnvironment(fn () => 'production');

    $this->artisan('platform:demo')->assertFailed();
    expect(User::query()->where('email', DemoSeeder::OWNER_EMAIL)->exists())->toBeFalse();
});
