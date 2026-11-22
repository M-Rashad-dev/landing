<?php

declare(strict_types=1);

use App\Enums\NotificationEvent;
use App\Mail\CustomerOrderMail;
use App\Mail\NotificationMail;
use App\Mail\Store\FakeMailbox;
use App\Mail\Store\Mailbox;
use App\Mail\Store\MailboxError;
use App\Mail\Store\SmtpMailbox;
use App\Models\Identity;
use App\Models\Order;
use App\Models\OutboundMessage;
use App\Models\StoreMailSetting;
use App\Models\UserNotification;
use App\Notifications\CustomerNotices;
use App\Services\Dns\DnsResolver;
use Illuminate\Support\Facades\Mail;

const SM_URL = '/api/v1/dashboard/mail-settings';

beforeEach(function () {
    Mail::fake();
    $this->user = actingAsOwner();
    $this->user->tenant->update(['name' => 'متجر حبة']);
});

function smBox(): FakeMailbox
{
    /** @var FakeMailbox $box */
    $box = app(Mailbox::class);

    return $box;
}

function smGmail(array $override = []): array
{
    return $override + [
        'mode' => 'smtp', 'sender_name' => null, 'reply_to' => null,
        'smtp_host' => 'smtp.gmail.com', 'smtp_port' => 465, 'smtp_encryption' => 'ssl',
        'smtp_username' => 'Habba.Store@gmail.com', 'smtp_password' => 'abcd efgh ijkl mnop', 'from_address' => null,
    ];
}

function smOrderEmail(): Order
{
    $order = asTenant(test()->user, fn () => Order::factory()->create(['total' => '450.00', 'customer_email' => 'sara@example.com', 'whatsapp_opt_in' => false]));
    app(CustomerNotices::class)->received($order);

    return $order;
}

it('needs a signed-in merchant', function () {
    app('auth')->forgetGuards();
    $this->withHeaders(['Authorization' => ''])->getJson(SM_URL)->assertUnauthorized();
});

it('starts on the platform mail with the store name as sender and replies to the owner', function () {
    $this->getJson(SM_URL)->assertOk()
        ->assertJsonPath('data.mode', 'platform')
        ->assertJsonPath('data.default_sender_name', 'متجر حبة')
        ->assertJsonPath('data.default_reply_to', $this->user->email)
        ->assertJsonPath('data.platform_address', config('mail.from.address'))
        ->assertJsonPath('data.smtp.has_password', false);

    // The identity's contact email wins over the login email.
    asTenant($this->user, fn () => Identity::factory()->create(['is_default' => true, 'contact' => ['email' => 'hello@habba.store']]));
    $this->getJson(SM_URL)->assertJsonPath('data.default_reply_to', 'hello@habba.store');
});

it('validates the settings', function () {
    $this->putJson(SM_URL, [])->assertStatus(422)->assertJsonValidationErrors(['mode']);
    $this->putJson(SM_URL, ['mode' => 'smtp'])->assertStatus(422)
        ->assertJsonValidationErrors(['smtp_host', 'smtp_port', 'smtp_encryption', 'smtp_username']);
    $this->putJson(SM_URL, smGmail(['smtp_host' => 'https://smtp.gmail.com', 'smtp_port' => 22, 'smtp_encryption' => 'none', 'reply_to' => 'nope']))->assertStatus(422)
        ->assertJsonValidationErrors(['smtp_host', 'smtp_port', 'smtp_encryption', 'reply_to']);
    $this->putJson(SM_URL, smGmail(['smtp_password' => '']))->assertStatus(422)->assertJsonValidationErrors(['smtp_password']);
    expect(asTenant($this->user, fn () => StoreMailSetting::query()->count()))->toBe(0);
});

it('keeps a mailbox only after logging in to it, and never shows the password back', function () {
    smBox()->fail = 'الإيميل أو كلمة سر التطبيق مش صحيحة.';
    $this->putJson(SM_URL, smGmail())->assertStatus(422)->assertJsonPath('errors.smtp_password.0', 'الإيميل أو كلمة سر التطبيق مش صحيحة.');
    expect(asTenant($this->user, fn () => StoreMailSetting::query()->count()))->toBe(0);

    smBox()->fail = null;
    smBox()->checks = 0;
    $json = $this->putJson(SM_URL, smGmail(['sender_name' => 'حبة', 'reply_to' => 'Owner@Habba.Store']))->assertOk()
        ->assertJsonPath('data.mode', 'smtp')
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.reply_to', 'owner@habba.store')
        ->assertJsonPath('data.smtp.username', 'habba.store@gmail.com')
        ->assertJsonPath('data.smtp.has_password', true)
        ->json();
    expect(json_encode($json))->not->toContain('abcdefghijklmnop');

    $settings = asTenant($this->user, fn () => StoreMailSetting::query()->sole());
    expect($settings->smtp_password)->toBe('abcdefghijklmnop')
        ->and($settings->getRawOriginal('smtp_password'))->not->toContain('abcdefghijklmnop')
        ->and(smBox()->checks)->toBe(1);

    // Saving again without the password keeps it and doesn't log in again; a new password is checked.
    $this->putJson(SM_URL, smGmail(['smtp_password' => null, 'sender_name' => 'حبة للتوابل']))->assertOk()->assertJsonPath('data.sender_name', 'حبة للتوابل');
    expect(smBox()->checks)->toBe(1);
    $this->putJson(SM_URL, smGmail(['smtp_password' => 'new-pass']))->assertOk();
    expect(smBox()->checks)->toBe(2);
});

it('sends order emails from the merchant\'s own mailbox, replies to him', function () {
    $this->putJson(SM_URL, smGmail(['sender_name' => 'حبة', 'reply_to' => 'owner@habba.store']))->assertOk();

    smOrderEmail();

    expect(smBox()->sent)->toHaveCount(1);
    $sent = smBox()->sent[0];
    expect($sent['to'])->toBe('sara@example.com')
        ->and($sent['mail'])->toBeInstanceOf(CustomerOrderMail::class)
        ->and($sent['mail']->from)->toBe([['name' => 'حبة', 'address' => 'habba.store@gmail.com']])
        ->and($sent['mail']->hasReplyTo('owner@habba.store'))->toBeTrue();
    Mail::assertNothingSent();
    expect(OutboundMessage::query()->sole())->channel->toBe('email')->via->toBe('smtp');
});

it('falls back to the platform mail when the merchant\'s mailbox fails, and tells him once a day', function () {
    $this->putJson(SM_URL, smGmail())->assertOk();
    smBox()->fail = 'مقدرناش نوصل لسيرفر الإيميل.';

    smOrderEmail();
    smOrderEmail();

    Mail::assertSent(CustomerOrderMail::class, fn (CustomerOrderMail $m) => $m->hasTo('sara@example.com')
        && $m->from === [['name' => 'متجر حبة', 'address' => (string) config('mail.from.address')]]
        && $m->hasReplyTo($this->user->email));
    expect(OutboundMessage::query()->pluck('via')->all())->toBe(['platform', 'platform']);

    $settings = asTenant($this->user, fn () => StoreMailSetting::query()->sole());
    expect($settings->status)->toBe('failed')->and($settings->last_error)->toBe('مقدرناش نوصل لسيرفر الإيميل.');
    expect(UserNotification::query()->where('event', NotificationEvent::MailboxFailed->value)->count())->toBe(1);
    $this->getJson(SM_URL)->assertJsonPath('data.status', 'failed')->assertJsonPath('data.last_error', 'مقدرناش نوصل لسيرفر الإيميل.');
});

it('sends platform mail in the store\'s name with replies to the merchant by default', function () {
    $this->putJson(SM_URL, ['mode' => 'platform', 'sender_name' => 'حبة', 'reply_to' => 'owner@habba.store'])->assertOk();

    smOrderEmail();

    Mail::assertSent(CustomerOrderMail::class, fn (CustomerOrderMail $m) => $m->from === [['name' => 'حبة', 'address' => (string) config('mail.from.address')]] && $m->hasReplyTo('owner@habba.store'));
    expect(smBox()->sent)->toBe([])->and(OutboundMessage::query()->sole()->via)->toBe('platform');
});

it('sends a test email the way customers get them', function () {
    $this->postJson(SM_URL.'/test', ['to' => 'nope'])->assertStatus(422)->assertJsonValidationErrors(['to']);

    $this->postJson(SM_URL.'/test')->assertOk()->assertJsonPath('data.via', 'platform')->assertJsonPath('data.to', $this->user->email);
    Mail::assertSent(NotificationMail::class, fn (NotificationMail $m) => $m->hasTo($this->user->email) && str_contains($m->heading, 'متجر حبة'));

    $this->putJson(SM_URL, smGmail())->assertOk();
    $this->postJson(SM_URL.'/test', ['to' => 'me@habba.store'])->assertOk()->assertJsonPath('data.via', 'smtp');
    expect(smBox()->sent[0]['to'])->toBe('me@habba.store');

    // A failing mailbox says why and sends nothing from the platform instead.
    smBox()->fail = 'الإيميل أو كلمة سر التطبيق مش صحيحة.';
    $this->postJson(SM_URL.'/test')->assertStatus(422)->assertJsonPath('code', 'mailbox_failed');
    Mail::assertSentCount(1);
    expect(UserNotification::query()->where('event', NotificationEvent::MailboxFailed->value)->count())->toBe(0);
});

it('forgets the mailbox and goes back to the platform mail', function () {
    $this->putJson(SM_URL, smGmail())->assertOk();

    $this->deleteJson(SM_URL.'/mailbox')->assertOk()->assertJsonPath('data.mode', 'platform')->assertJsonPath('data.smtp.has_password', false)->assertJsonPath('data.smtp.host', null);
    expect(asTenant($this->user, fn () => StoreMailSetting::query()->sole()->getRawOriginal('smtp_password')))->toBeNull();
});

it('keeps every store\'s mailbox to itself', function () {
    $this->putJson(SM_URL, smGmail())->assertOk();
    $other = actingAsOwner();

    $this->getJson(SM_URL)->assertOk()->assertJsonPath('data.mode', 'platform')->assertJsonPath('data.smtp.host', null);
    $order = asTenant($other, fn () => Order::factory()->create(['customer_email' => 'omar@example.com', 'whatsapp_opt_in' => false]));
    app(CustomerNotices::class)->received($order);

    expect(smBox()->sent)->toBe([]);
    Mail::assertSent(CustomerOrderMail::class, fn (CustomerOrderMail $m) => $m->hasTo('omar@example.com') && $m->hasReplyTo($other->email));
});

it('refuses mail servers inside our network', function () {
    $dns = new class implements DnsResolver
    {
        public function cnameTargets(string $host): array
        {
            return [];
        }

        public function ipv4(string $host): array
        {
            return $host === 'mail.evil.test' ? ['10.0.0.5'] : [];
        }
    };
    $box = new SmtpMailbox($dns, app('view'), app('events'));
    $settings = new StoreMailSetting(['smtp_port' => 587, 'smtp_encryption' => 'tls', 'smtp_username' => 'a@b.c', 'smtp_password' => 'x']);

    foreach (['mail.evil.test' => 'private_host', '127.0.0.1' => 'private_host', 'nowhere.test' => 'host'] as $host => $key) {
        $settings->smtp_host = $host;
        expect(fn () => $box->check($settings))->toThrow(MailboxError::class, (string) __('store_mail.errors.'.$key));
    }
});
