<?php

declare(strict_types=1);

use App\Auth\PermissionCatalog;
use App\Enums\UserRole;
use App\Http\Middleware\EnforceStaffPermissions;
use App\Mail\NotificationMail;
use App\Models\ActivityLog;
use App\Models\Order;
use App\Models\Product;
use App\Models\StaffInvitation;
use App\Models\User;
use App\Models\UserNotification;
use App\Notifications\StoreNotices;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Mail::fake();
    $this->owner = actingAsOwner();
    $this->owner->tenant->forceFill(['plan_key' => 'pro'])->save();
});

/** Adds a staff member through the API; returns him and his invitation token (read from the email). */
function addStaff(array $permissions, array $extra = []): array
{
    $id = test()->postJson('/api/v1/dashboard/staff', $extra + ['name' => 'منى', 'email' => 'mona@example.com', 'phone' => '01055556666', 'permissions' => $permissions])->assertCreated()->json('data.id');
    $token = null;
    Mail::assertSent(NotificationMail::class, function (NotificationMail $m) use (&$token): bool {
        $token = (string) preg_replace('#^.*/invite/#', '', (string) $m->actionUrl);

        return $m->event === 'staff_invitation';
    });

    return [User::query()->findOrFail($id), $token];
}

function asStaff(User $user): void
{
    app('auth')->forgetGuards();
    Sanctum::actingAs($user->fresh());
}

it('maps every dashboard route to a permission the catalog knows', function () {
    $missing = [];
    foreach (Route::getRoutes() as $route) {
        if (! str_starts_with($route->uri(), 'api/v1/dashboard/')) {
            continue;
        }
        $permission = EnforceStaffPermissions::permissionFor($route);
        if ($permission === null || (! PermissionCatalog::exists($permission) && ! in_array($permission, [PermissionCatalog::ANY, PermissionCatalog::SELF], true))) {
            $missing[] = EnforceStaffPermissions::keyFor($route);
        }
    }

    expect($missing)->toBe([]);
});

it('adds a staff member who sets his password from the emailed link and signs in', function () {
    $this->postJson('/api/v1/dashboard/staff', ['name' => 'م', 'email' => 'x', 'phone' => '123', 'permissions' => ['orders.nope']])->assertStatus(422)->assertJsonValidationErrors(['name', 'email', 'phone']);
    $this->postJson('/api/v1/dashboard/staff', ['name' => 'منى', 'email' => $this->owner->email, 'phone' => '01055556666', 'permissions' => []])->assertStatus(422)->assertJsonValidationErrors(['email']);
    $this->postJson('/api/v1/dashboard/staff', ['name' => 'منى', 'email' => 'm@example.com', 'phone' => '01055556666', 'permissions' => ['orders.nope']])->assertStatus(422)->assertJsonValidationErrors(['permissions']);

    [$staff, $token] = addStaff(['orders.view', 'orders.status']);
    expect($staff->role)->toBe(UserRole::Staff)->and($staff->tenant_id)->toBe($this->owner->tenant_id)->and($staff->getPermissionNames()->sort()->values()->all())->toBe(['orders.status', 'orders.view']);
    $this->getJson('/api/v1/dashboard/staff')->assertOk()->assertJsonPath('data.0.state', 'invited');

    app('auth')->forgetGuards();
    $this->postJson('/api/v1/auth/invitation/check', ['token' => $token])->assertOk()->assertJsonPath('data.name', 'منى');
    $this->postJson('/api/v1/auth/invitation/accept', ['token' => $token, 'password' => 'secret-pass-1', 'password_confirmation' => 'nope'])->assertStatus(422);
    $this->postJson('/api/v1/auth/invitation/accept', ['token' => $token, 'password' => 'secret-pass-1', 'password_confirmation' => 'secret-pass-1'])->assertOk()
        ->assertJsonPath('data.user.role', 'staff')->assertJsonStructure(['data' => ['token']]);
    $this->postJson('/api/v1/auth/invitation/accept', ['token' => $token, 'password' => 'secret-pass-2', 'password_confirmation' => 'secret-pass-2'])->assertStatus(410);
    $this->postJson('/api/v1/auth/login', ['login' => 'mona@example.com', 'password' => 'secret-pass-1'])->assertOk();

    expect(ActivityLog::query()->withoutGlobalScopes()->where('user_id', $staff->id)->where('summary', __('staff.signed_in'))->exists())->toBeTrue();
});

it('refuses an expired link', function () {
    [, $token] = addStaff([]);
    StaffInvitation::query()->update(['expires_at' => now()->subMinute()]);
    app('auth')->forgetGuards();
    $this->postJson('/api/v1/auth/invitation/check', ['token' => $token])->assertStatus(410);
});

it('lets staff open and do only what they were given', function () {
    [$staff] = addStaff(['orders.view', 'products.view']);
    $product = asTenant($this->owner, fn () => Product::factory()->create());
    $order = asTenant($this->owner, fn () => Order::factory()->create());
    asStaff($staff);

    $this->getJson('/api/v1/dashboard/orders')->assertOk();
    $this->getJson("/api/v1/dashboard/orders/{$order->id}")->assertOk();
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/status", ['status' => 'confirmed'])->assertForbidden()->assertJsonPath('code', 'permission_denied');
    $this->getJson('/api/v1/dashboard/orders/export')->assertForbidden();
    $this->getJson('/api/v1/dashboard/products')->assertOk();
    $this->deleteJson("/api/v1/dashboard/products/{$product->id}")->assertForbidden();
    $this->getJson('/api/v1/dashboard/domains')->assertForbidden();
    $this->getJson('/api/v1/dashboard/staff')->assertForbidden();
    // His own things and shared lookups always work.
    $this->getJson('/api/v1/dashboard/notifications')->assertOk();
    $this->getJson('/api/v1/dashboard/billing/usage')->assertOk();
    $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.user.permissions', ['orders.view', 'products.view']);

    // The owner gives more: it works on the next request.
    app('auth')->forgetGuards();
    Sanctum::actingAs($this->owner);
    $this->putJson("/api/v1/dashboard/staff/{$staff->id}", ['permissions' => ['orders.view', 'orders.status', 'products.view', 'products.delete']])->assertOk();
    asStaff($staff);
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/status", ['status' => 'confirmed'])->assertOk();
    $this->deleteJson("/api/v1/dashboard/products/{$product->id}")->assertNoContent();
    expect(ActivityLog::query()->withoutGlobalScopes()->where('user_id', $staff->id)->where('permission', 'orders.status')->where('subject_id', $order->id)->exists())->toBeTrue();
});

it('lets staff who manage staff give only what they have, and never touch the owner', function () {
    [$manager] = addStaff(['staff.view', 'staff.create', 'staff.update', 'orders.view']);
    asStaff($manager);

    $this->postJson('/api/v1/dashboard/staff', ['name' => 'علي', 'email' => 'ali@example.com', 'phone' => '01077778888', 'permissions' => ['billing.pay']])->assertStatus(422)->assertJsonValidationErrors(['permissions']);
    $id = $this->postJson('/api/v1/dashboard/staff', ['name' => 'علي', 'email' => 'ali@example.com', 'phone' => '01077778888', 'permissions' => ['orders.view']])->assertCreated()->json('data.id');
    $this->putJson("/api/v1/dashboard/staff/{$this->owner->id}", ['permissions' => []])->assertNotFound();
    $this->putJson("/api/v1/dashboard/staff/{$manager->id}", ['permissions' => ['staff.view']])->assertStatus(422);
    $this->deleteJson("/api/v1/dashboard/staff/{$id}")->assertForbidden();
});

it('stops a staff member at once and keeps to the plan\'s seats', function () {
    [$staff] = addStaff(['orders.view']);
    $staff->createToken('dashboard');
    $this->postJson("/api/v1/dashboard/staff/{$staff->id}/toggle")->assertOk()->assertJsonPath('data.state', 'stopped');
    expect($staff->tokens()->count())->toBe(0);
    asStaff($staff);
    $this->getJson('/api/v1/dashboard/orders')->assertForbidden();

    app('auth')->forgetGuards();
    Sanctum::actingAs($this->owner);
    addStaff([], ['email' => 'b@example.com', 'phone' => '01066667777']);
    addStaff([], ['email' => 'c@example.com', 'phone' => '01088889999']);
    // pro = 3 seats.
    $this->postJson('/api/v1/dashboard/staff', ['name' => 'رابع', 'email' => 'd@example.com', 'phone' => '01099990000', 'permissions' => []])->assertForbidden()->assertJsonPath('code', 'plan_limit_reached');
});

it('tells each person only what his permissions cover', function () {
    [$orders] = addStaff(['orders.view']);
    [$products] = addStaff(['products.view'], ['email' => 'p@example.com', 'phone' => '01011112233']);
    $order = asTenant($this->owner, fn () => Order::factory()->create());

    app(StoreNotices::class)->newOrder($order);

    expect(UserNotification::query()->pluck('user_id')->sort()->values()->all())->toBe(collect([$this->owner->id, $orders->id])->sort()->values()->all())
        ->and(UserNotification::query()->where('user_id', $products->id)->exists())->toBeFalse();
});

it('keeps staff to their own store', function () {
    [$staff] = addStaff(['staff.view', 'staff.update']);
    $other = createOwner();
    Sanctum::actingAs($other);

    $this->getJson('/api/v1/dashboard/staff')->assertOk()->assertJsonPath('data', []);
    $this->putJson("/api/v1/dashboard/staff/{$staff->id}", ['permissions' => []])->assertNotFound();
    $this->deleteJson("/api/v1/dashboard/staff/{$staff->id}")->assertNotFound();
    app('auth')->forgetGuards();
    $this->withHeaders(['Authorization' => ''])->getJson('/api/v1/dashboard/staff')->assertUnauthorized();
});
