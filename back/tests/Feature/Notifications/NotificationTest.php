<?php

declare(strict_types=1);

use App\Enums\MessagePurpose;
use App\Enums\NotificationEvent;
use App\Events\NotificationCreated;
use App\Mail\NotificationMail;
use App\Messaging\WhatsApp\WhatsAppTemplates;
use App\Models\Invoice;
use App\Models\OutboundMessage;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserNotification;
use App\Notifications\Notice;
use App\Notifications\NotificationCenter;
use App\Notifications\StoreNotices;
use App\Services\AdminAlerts;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;

const NOTIFY_GRAPH = 'https://graph.facebook.com/v23.0';

function notifyWhatsappOn(): void
{
    config([
        'services.whatsapp.token' => 't', 'services.whatsapp.phone_number_id' => '111', 'services.whatsapp.waba_id' => '222',
        'services.whatsapp.graph_url' => NOTIFY_GRAPH,
    ]);
}

function notifiedOwner(array $attributes = []): User
{
    return User::factory()->for(Tenant::factory()->create(['name' => 'متجر حبة']))->create($attributes + ['phone' => '+201011112222', 'email' => 'owner@habba.test']);
}

function simpleNotice(?string $dedupe = null): Notice
{
    return new Notice(NotificationEvent::ReceiptApproved, 'تم قبول إيصال الدفع', 'إيصال الفاتورة INV-1 اتقبل.', '/dashboard/settings/billing', whatsappTemplate: 'receipt_approved', whatsappParams: ['INV-1'], dedupeKey: $dedupe);
}

it('rings the bell live and sends the WhatsApp copy to the owner by default', function () {
    notifyWhatsappOn();
    Event::fake([NotificationCreated::class]);
    Mail::fake();
    Http::fake([NOTIFY_GRAPH.'/111/messages' => Http::response(['messages' => [['id' => 'wamid.N1']]])]);
    $owner = notifiedOwner();

    app(NotificationCenter::class)->toStore($owner->tenant_id, simpleNotice());

    expect(UserNotification::query()->where('user_id', $owner->id)->sole()->title)->toBe('تم قبول إيصال الدفع');
    Event::assertDispatched(NotificationCreated::class, fn (NotificationCreated $e) => $e->userId === $owner->id && $e->broadcastOn()[0]->name === 'private-user.'.$owner->id);
    Http::assertSent(fn (Request $request): bool => $request->data()['to'] === '201011112222'
        && $request->data()['template']['name'] === WhatsAppTemplates::name('receipt_approved')
        && $request->data()['template']['components'][0]['parameters'][0]['text'] === 'INV-1');
    expect(OutboundMessage::query()->sole())->purpose->toBe(MessagePurpose::Notification)->tenant_id->toBe($owner->tenant_id);
    Mail::assertNothingSent();
});

it('emails instead when the owner chose email, or when WhatsApp can\'t send', function () {
    Mail::fake();
    $byEmail = notifiedOwner(['notify_channel' => 'email']);
    app(NotificationCenter::class)->toStore($byEmail->tenant_id, simpleNotice());
    Mail::assertSent(NotificationMail::class, fn (NotificationMail $mail) => $mail->hasTo('owner@habba.test') && str_ends_with((string) $mail->actionUrl, '/dashboard/settings/billing'));

    // WhatsApp chosen but Meta refuses (e.g. template not approved yet): the email copy goes.
    notifyWhatsappOn();
    Http::fake([NOTIFY_GRAPH.'/*' => Http::response(['error' => ['code' => 132001, 'message' => 'Template name does not exist in the translation']], 404)]);
    $byWhatsapp = notifiedOwner(['phone' => '+201033334444', 'email' => 'second@habba.test']);
    app(NotificationCenter::class)->toStore($byWhatsapp->tenant_id, simpleNotice());
    Mail::assertSent(NotificationMail::class, fn (NotificationMail $mail) => $mail->hasTo('second@habba.test'));
    expect(OutboundMessage::query()->where('recipient', '+201033334444')->value('error_code'))->toBe('132001');
});

it('gives a reminder once (dedupe key)', function () {
    Mail::fake();
    $owner = notifiedOwner(['notify_channel' => 'email']);
    app(NotificationCenter::class)->toStore($owner->tenant_id, simpleNotice('r:1'));
    app(NotificationCenter::class)->toStore($owner->tenant_id, simpleNotice('r:1'));

    expect(UserNotification::query()->where('user_id', $owner->id)->count())->toBe(1);
    Mail::assertSentCount(1);
});

it('reminds before the plan ends (7, 3, 1 days) and when it ended, once each', function () {
    Mail::fake();
    $owner = notifiedOwner(['notify_channel' => 'email']);
    $tenant = $owner->tenant;
    $tenant->forceFill(['plan_key' => 'pro', 'plan_ends_at' => now()->addDays(3)->subHour()])->save();

    $this->artisan('notifications:plan-reminders')->assertSuccessful();
    $this->artisan('notifications:plan-reminders')->assertSuccessful();
    $rows = UserNotification::query()->where('user_id', $owner->id)->get();
    expect($rows)->toHaveCount(1)
        ->and($rows[0]->event)->toBe(NotificationEvent::PlanExpiring)
        ->and($rows[0]->title)->toContain('3 أيام');

    // Not a reminder day: nothing new.
    $tenant->forceFill(['plan_ends_at' => now()->addDays(5)->subHour()])->save();
    $this->artisan('notifications:plan-reminders')->assertSuccessful();
    expect(UserNotification::query()->where('user_id', $owner->id)->count())->toBe(1);

    $tenant->forceFill(['plan_ends_at' => now()->subHour()])->save();
    $this->artisan('notifications:plan-reminders')->assertSuccessful();
    $this->artisan('notifications:plan-reminders')->assertSuccessful();
    expect(UserNotification::query()->where('user_id', $owner->id)->where('event', 'plan_expired')->count())->toBe(1);
});

it('tells the owner about a receipt decision', function () {
    Mail::fake();
    $owner = notifiedOwner(['notify_channel' => 'email']);
    $invoice = (new Invoice)->forceFill(['tenant_id' => $owner->tenant_id, 'number' => 'INV-77', 'total' => '100.00']);

    app(StoreNotices::class)->receiptRejected($invoice, 'المبلغ ناقص');

    $row = UserNotification::query()->where('user_id', $owner->id)->sole();
    expect($row->event)->toBe(NotificationEvent::ReceiptRejected)->and($row->body)->toContain('INV-77')->toContain('المبلغ ناقص');
});

it('tells the owner once per support answer, not for every line of it', function () {
    Mail::fake();
    $owner = actingAsOwner(notifiedOwner(['notify_channel' => 'email']));
    $number = $this->postJson('/api/v1/dashboard/support/tickets', ['topic' => 'orders', 'body' => 'عندي مشكلة'])->assertCreated()->json('data.ticket.number');
    Sanctum::actingAs(User::factory()->superAdmin()->create());
    $this->postJson("/api/v1/admin/support/tickets/{$number}/messages", ['body' => 'أهلًا، بنشوفها'])->assertCreated();
    $this->postJson("/api/v1/admin/support/tickets/{$number}/messages", ['body' => 'اتحلت'])->assertCreated();

    expect(UserNotification::query()->where('user_id', $owner->id)->where('event', 'support_reply')->count())->toBe(1);
});

it('lists the signed-in user\'s own bell only, and marks it read', function () {
    $owner = notifiedOwner(['notify_channel' => 'email']);
    $other = notifiedOwner(['phone' => '+201055556666', 'email' => 'other@shop.test', 'notify_channel' => 'email']);
    Mail::fake();
    foreach (range(1, 22) as $i) {
        app(NotificationCenter::class)->toStore($owner->tenant_id, simpleNotice('n:'.$i));
    }
    app(NotificationCenter::class)->toStore($other->tenant_id, simpleNotice());
    $foreign = UserNotification::query()->where('user_id', $other->id)->value('id');

    actingAsOwner($owner);
    $page = $this->getJson('/api/v1/dashboard/notifications')->assertOk()
        ->assertJsonCount(20, 'data.items')
        ->assertJsonPath('data.has_more', true)
        ->assertJsonPath('data.unread', 22);
    $this->getJson('/api/v1/dashboard/notifications?before='.$page->json('data.items.19.id'))->assertOk()->assertJsonCount(2, 'data.items')->assertJsonPath('data.has_more', false);

    $first = $page->json('data.items.0.id');
    $this->postJson("/api/v1/dashboard/notifications/{$first}/read")->assertNoContent();
    // Someone else's notification: nothing happens.
    $this->postJson("/api/v1/dashboard/notifications/{$foreign}/read")->assertNoContent();
    expect(UserNotification::query()->find($foreign)->read_at)->toBeNull();
    $this->getJson('/api/v1/dashboard/notifications')->assertJsonPath('data.unread', 21)->assertJsonPath('data.items.0.read', true);

    $this->postJson('/api/v1/dashboard/notifications/read')->assertNoContent();
    $this->getJson('/api/v1/dashboard/notifications')->assertJsonPath('data.unread', 0);
    expect(UserNotification::query()->where('user_id', $other->id)->whereNull('read_at')->count())->toBe(1);
});

it('lets the owner choose WhatsApp or email', function () {
    $owner = actingAsOwner(notifiedOwner());
    $this->getJson('/api/v1/dashboard/profile/notifications')->assertOk()->assertJsonPath('data.channel', 'whatsapp');
    $this->putJson('/api/v1/dashboard/profile/notifications', ['channel' => 'sms'])->assertStatus(422)->assertJsonValidationErrors('channel');
    $this->putJson('/api/v1/dashboard/profile/notifications', ['channel' => 'email'])->assertOk()->assertJsonPath('data.channel', 'email');
    expect($owner->fresh()->notify_channel->value)->toBe('email');
});

it('keeps the bell to signed-in users', function () {
    $this->getJson('/api/v1/dashboard/notifications')->assertUnauthorized();
    $this->getJson('/api/v1/admin/notifications')->assertUnauthorized();
    $this->putJson('/api/v1/dashboard/profile/notifications', ['channel' => 'email'])->assertUnauthorized();

    actingAsOwner(notifiedOwner());
    $this->getJson('/api/v1/admin/notifications')->assertForbidden();
});

it('gives the platform admins their own bell', function () {
    Mail::fake();
    $admin = User::factory()->superAdmin()->create();
    app(StoreNotices::class);
    app(AdminAlerts::class)->storeRegistered(Tenant::factory()->create(['name' => 'متجر جديد']), notifiedOwner(), 'new.platform.test');

    Sanctum::actingAs($admin);
    $this->getJson('/api/v1/admin/notifications')->assertOk()
        ->assertJsonPath('data.unread', 1)
        ->assertJsonPath('data.items.0.event', 'store_registered');
});
