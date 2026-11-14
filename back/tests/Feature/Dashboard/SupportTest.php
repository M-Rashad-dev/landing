<?php

declare(strict_types=1);

use App\Billing\PlatformSettings;
use App\Events\SupportUpdated;
use App\Mail\AdminAlertMail;
use App\Models\Domain;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Contracts\Broadcasting\Broadcaster;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Storage::fake('local');
    Event::fake([SupportUpdated::class]);
});

function openTicket(array $data = []): array
{
    return test()->post('/api/v1/dashboard/support/tickets', [...['topic' => 'orders', 'body' => 'عندي مشكلة في الطلبات'], ...$data], ['Accept' => 'application/json'])
        ->assertCreated()->json('data');
}

function asSupport(): User
{
    $admin = User::factory()->superAdmin()->create(['name' => 'أدمن سري']);
    Sanctum::actingAs($admin);

    return $admin;
}

it('opens a conversation with a number, a picture, the page it came from, and tells the platform', function () {
    Mail::fake();
    app(PlatformSettings::class)->save(['alert_email' => 'owner@platform.test', 'alert_events' => ['support_ticket']]);
    actingAsOwner();

    $data = openTicket(['page' => '/dashboard/orders', 'files' => [UploadedFile::fake()->image('screen.png', 400, 300)]]);

    expect($data['ticket']['number'])->toBeGreaterThan(1000)
        ->and($data['ticket']['status'])->toBe('waiting_support')
        ->and($data['messages'][0]['sender'])->toBe('merchant')
        ->and($data['messages'][0]['attachments'][0])->toMatchArray(['kind' => 'image', 'mime' => 'image/png', 'name' => 'screen.png']);
    Mail::assertQueued(AdminAlertMail::class, fn ($mail) => $mail->hasTo('owner@platform.test'));
    Event::assertDispatched(SupportUpdated::class, fn ($e) => $e->ticket['number'] === $data['ticket']['number'] && $e->message !== null);
});

it('allows two open conversations at most, a new one only 12 hours after the last, any time once closed', function () {
    actingAsOwner();
    $first = openTicket();

    $this->postJson('/api/v1/dashboard/support/tickets', ['topic' => 'billing', 'body' => 'سؤال تاني'])
        ->assertStatus(422)->assertJsonPath('code', 'support_limit');
    $this->getJson('/api/v1/dashboard/support/summary')->assertJsonPath('data.can_open', false)->assertJsonPath('data.open', 1);

    $this->travel(13)->hours();
    openTicket(['topic' => 'billing']);
    $this->travel(13)->hours();
    $this->postJson('/api/v1/dashboard/support/tickets', ['topic' => 'other', 'body' => 'تالت'])
        ->assertStatus(422)->assertJsonPath('message', __('support.limit', ['count' => 2]));

    $this->postJson("/api/v1/dashboard/support/tickets/{$first['ticket']['number']}/close")->assertOk()->assertJsonPath('data.status', 'closed');
    openTicket(['topic' => 'other']);
});

it('passes the turn between the store and support, with unread counts and read receipts', function () {
    $owner = actingAsOwner();
    $number = openTicket()['ticket']['number'];
    $admin = asSupport();

    $this->getJson('/api/v1/admin/support/unread')->assertJsonPath('data.unread', 1);
    $this->post("/api/v1/admin/support/tickets/{$number}/messages", ['body' => 'أهلًا، بنشوفها حالًا'], ['Accept' => 'application/json'])->assertCreated()
        ->assertJsonPath('data.sender', 'support');
    $ticket = SupportTicket::query()->withoutGlobalScopes()->where('number', $number)->first();
    expect($ticket->status->value)->toBe('waiting_merchant')->and($ticket->first_response_at)->not->toBeNull();
    $this->getJson('/api/v1/admin/support/unread')->assertJsonPath('data.unread', 0);

    Sanctum::actingAs($owner);
    $this->getJson('/api/v1/dashboard/support/summary')->assertJsonPath('data.unread', 1);
    $conversation = $this->getJson("/api/v1/dashboard/support/tickets/{$number}")->assertOk()->json('data');
    expect($conversation['messages'][1])->not->toHaveKey('user_id')
        ->and(json_encode($conversation, JSON_UNESCAPED_UNICODE))->not->toContain($admin->name)
        ->and($conversation['ticket']['closes_at'])->not->toBeNull();
    $this->postJson("/api/v1/dashboard/support/tickets/{$number}/read")->assertOk()->assertJsonPath('data.unread_merchant', false);
    $this->getJson('/api/v1/dashboard/support/summary')->assertJsonPath('data.unread', 0);

    $this->post("/api/v1/dashboard/support/tickets/{$number}/messages", ['body' => 'تمام شكرًا'], ['Accept' => 'application/json'])->assertCreated();
    expect($ticket->fresh()->status->value)->toBe('waiting_support');
});

it('closes a conversation by itself 12 hours after support’s last reply without an answer', function () {
    $owner = actingAsOwner();
    $waiting = openTicket()['ticket']['number'];
    $this->travel(13)->hours();
    $answered = openTicket(['topic' => 'domain'])['ticket']['number'];
    asSupport();
    $this->post("/api/v1/admin/support/tickets/{$answered}/messages", ['body' => 'جرب تاني'], ['Accept' => 'application/json'])->assertCreated();

    $this->travel(11)->hours();
    $this->artisan('support:close-idle')->assertSuccessful();
    expect(SupportTicket::query()->withoutGlobalScopes()->where('number', $answered)->first()->status->value)->toBe('waiting_merchant');

    $this->travel(2)->hours();
    $this->artisan('support:close-idle')->assertSuccessful();
    $closed = SupportTicket::query()->withoutGlobalScopes()->where('number', $answered)->first();
    expect($closed->status->value)->toBe('closed')->and($closed->close_reason)->toBe('auto')
        ->and(SupportTicket::query()->withoutGlobalScopes()->where('number', $waiting)->first()->status->value)->toBe('waiting_support')
        ->and(SupportMessage::query()->withoutGlobalScopes()->where('support_ticket_id', $closed->id)->latest('id')->value('body'))->toBe(__('support.system.closed_auto'));

    Sanctum::actingAs($owner);
    $this->post("/api/v1/dashboard/support/tickets/{$answered}/messages", ['body' => 'لسه'], ['Accept' => 'application/json'])
        ->assertStatus(422)->assertJsonPath('code', 'support_closed');
});

it('is rated once after it closes, and support can close and reopen it', function () {
    $owner = actingAsOwner();
    $number = openTicket()['ticket']['number'];

    $this->postJson("/api/v1/dashboard/support/tickets/{$number}/rating", ['rating' => 5, 'resolved' => true])->assertStatus(422)->assertJsonPath('code', 'support_open');
    asSupport();
    $this->postJson("/api/v1/admin/support/tickets/{$number}/close")->assertOk()->assertJsonPath('data.close_reason', 'support');

    Sanctum::actingAs($owner);
    $this->postJson("/api/v1/dashboard/support/tickets/{$number}/rating", ['rating' => 7, 'resolved' => 'x'])->assertStatus(422)->assertJsonValidationErrors(['rating', 'resolved']);
    $this->postJson("/api/v1/dashboard/support/tickets/{$number}/rating", ['rating' => 2, 'resolved' => false, 'comment' => '<b>رد متأخر</b>'])->assertOk()
        ->assertJsonPath('data.rating', 2)->assertJsonPath('data.rating_comment', 'رد متأخر');
    $this->postJson("/api/v1/dashboard/support/tickets/{$number}/rating", ['rating' => 5, 'resolved' => true])->assertStatus(422)->assertJsonPath('code', 'support_rated');

    asSupport();
    $this->postJson("/api/v1/admin/support/tickets/{$number}/reopen")->assertOk()->assertJsonPath('data.status', 'waiting_support')->assertJsonPath('data.rating', null);
    $this->postJson("/api/v1/admin/support/tickets/{$number}/reopen")->assertStatus(422);
});

it('accepts images and videos up to their size, never other files', function () {
    actingAsOwner();
    $number = openTicket()['ticket']['number'];
    $send = fn (array $files) => $this->post("/api/v1/dashboard/support/tickets/{$number}/messages", ['files' => $files], ['Accept' => 'application/json']);

    $send([UploadedFile::fake()->create('clip.mp4', 2048, 'video/mp4')])->assertCreated()->assertJsonPath('data.attachments.0.kind', 'video');
    $send([UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf')])->assertStatus(422)->assertJsonValidationErrors(['files.0' => __('support.file_type')]);
    $send([UploadedFile::fake()->create('big.mp4', 51 * 1024, 'video/mp4')])->assertStatus(422)->assertJsonValidationErrors(['files.0' => __('support.video_size', ['max' => 50])]);
    $send(array_fill(0, 6, UploadedFile::fake()->image('a.png')))->assertStatus(422)->assertJsonValidationErrors('files');
    $this->postJson("/api/v1/dashboard/support/tickets/{$number}/messages", ['body' => '   '])->assertStatus(422)->assertJsonPath('message', __('support.empty'));
});

it('lists, searches and measures support for the admin', function () {
    $owner = createOwner();
    $owner->tenant->update(['name' => 'متجر النور']);
    Sanctum::actingAs($owner);
    $number = openTicket()['ticket']['number'];
    $admin = asSupport();
    $this->travel(30)->minutes();
    $this->post("/api/v1/admin/support/tickets/{$number}/messages", ['body' => 'رد'], ['Accept' => 'application/json'])->assertCreated();
    $this->postJson("/api/v1/admin/support/tickets/{$number}/close")->assertOk();
    Sanctum::actingAs($owner);
    $this->postJson("/api/v1/dashboard/support/tickets/{$number}/rating", ['rating' => 4, 'resolved' => true])->assertOk();
    Sanctum::actingAs($admin);

    $this->getJson('/api/v1/admin/support/tickets?status=closed')->assertOk()
        ->assertJsonPath('data.0.number', $number)->assertJsonPath('data.0.store.name', 'متجر النور')
        ->assertJsonPath('meta.counts.closed', 1)->assertJsonPath('meta.counts.all', 1);
    $this->getJson('/api/v1/admin/support/tickets?status=all&q=%23'.$number)->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/admin/support/tickets?status=all&q=النور')->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/admin/support/tickets?status=all&q=مفيش')->assertJsonCount(0, 'data');
    $this->getJson("/api/v1/admin/support/tickets/{$number}")->assertOk()->assertJsonPath('ticket.context.page', null)->assertJsonCount(3, 'data.messages');

    $stats = $this->getJson('/api/v1/admin/support/stats?days=7')->assertOk()->json('data');
    expect($stats)->toMatchArray(['opened' => 1, 'closed' => 1, 'rating' => 4, 'satisfied_percent' => 100, 'resolved_percent' => 100])
        ->and($stats['first_reply_minutes'])->toBe(30)
        ->and($stats['topics'])->toBe(['orders' => 1])
        ->and($stats['daily'])->toHaveCount(7);
});

it('keeps each store to its own conversations and files, and the inbox to the platform', function () {
    $this->getJson('/api/v1/dashboard/support/tickets')->assertUnauthorized();
    $this->getJson('/api/v1/admin/support/tickets')->assertUnauthorized();

    $other = actingAsOwner();
    $data = openTicket(['files' => [UploadedFile::fake()->image('x.png', 100, 100)]]);
    $file = $data['messages'][0]['attachments'][0]['id'];
    $this->get("/api/v1/dashboard/support/attachments/{$file}")->assertOk();

    actingAsOwner();
    $this->getJson("/api/v1/dashboard/support/tickets/{$data['ticket']['number']}")->assertNotFound();
    $this->postJson("/api/v1/dashboard/support/tickets/{$data['ticket']['number']}/close")->assertNotFound();
    $this->getJson("/api/v1/dashboard/support/attachments/{$file}")->assertNotFound();
    $this->getJson('/api/v1/dashboard/support/tickets')->assertOk()->assertJsonCount(0, 'data');
    $this->getJson('/api/v1/admin/support/tickets')->assertForbidden();

    asSupport();
    $this->get("/api/v1/admin/support/attachments/{$file}")->assertOk();
    expect($other->tenant_id)->toBeInt();
});

it('stays open to a store whose plan has expired', function () {
    $tenant = Tenant::factory()->expired()->create();
    $user = User::factory()->for($tenant)->create();
    Domain::factory()->for($tenant)->create();
    Sanctum::actingAs($user->fresh(['tenant']));

    openTicket(['topic' => 'billing', 'body' => 'اشتراكي خلص']);
});

it('lets a store listen only to its own realtime channel', function () {
    $channels = app(Broadcaster::class)->getChannels();
    $store = $channels['support.tenant.{tenantId}'];
    $inbox = $channels['support.admin'];
    $owner = createOwner();
    $admin = User::factory()->superAdmin()->create();

    // Laravel passes the channel-name parts as strings.
    expect($store($owner, (string) $owner->tenant_id))->toBeTrue()
        ->and($store($owner, (string) ($owner->tenant_id + 1)))->toBeFalse()
        ->and($store($admin, (string) $owner->tenant_id))->toBeFalse()
        ->and($inbox($owner))->toBeFalse()
        ->and($inbox($admin))->toBeTrue();
});
