<?php

declare(strict_types=1);

use App\Actions\Orders\ChangeOrderStatus;
use App\Enums\MessagePurpose;
use App\Enums\OrderStatus;
use App\Mail\CustomerOrderMail;
use App\Messaging\WhatsApp\WhatsAppTemplates;
use App\Models\Customer;
use App\Models\Domain;
use App\Models\Order;
use App\Models\OutboundMessage;
use App\Models\Tenant;
use App\Notifications\CustomerNotices;
use App\Services\PublicSite;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;

const CN_GRAPH = 'https://graph.facebook.com/v23.0';
const CN_HOST = 'habba.localhost';

function cnWhatsappOn(): void
{
    config([
        'services.whatsapp.token' => 't', 'services.whatsapp.phone_number_id' => '111', 'services.whatsapp.waba_id' => '222',
        'services.whatsapp.graph_url' => CN_GRAPH,
    ]);
}

function cnTenant(): Tenant
{
    $tenant = Tenant::factory()->create(['name' => 'متجر حبة']);
    Domain::factory()->for($tenant)->create(['host' => CN_HOST, 'active_host' => CN_HOST, 'is_primary' => true]);

    return $tenant;
}

function cnOrder(Tenant $tenant, array $attributes = []): Order
{
    return asTenant($tenant, fn () => Order::factory()->create($attributes + [
        'order_number' => 1024, 'total' => '450.00', 'customer_phone' => '+201011112222', 'customer_email' => null, 'whatsapp_opt_in' => false,
    ]));
}

it('gives every order a private tracking token', function () {
    $order = cnOrder(cnTenant());

    expect($order->track_token)->toMatch('/^[a-z0-9]{12}$/');
});

it('messages the customer on WhatsApp when they agreed and gave no email', function () {
    cnWhatsappOn();
    Mail::fake();
    Http::fake([CN_GRAPH.'/111/messages' => Http::response(['messages' => [['id' => 'wamid.O1']]])]);
    $tenant = cnTenant();
    $order = cnOrder($tenant, ['whatsapp_opt_in' => true]);

    app(CustomerNotices::class)->received($order);

    Http::assertSent(function (Request $request) use ($order): bool {
        $template = $request->data()['template'];

        return $request->data()['to'] === '201011112222'
            && $template['name'] === WhatsAppTemplates::name('order_received')
            && array_column($template['components'][0]['parameters'], 'text') === ['1024', 'متجر حبة', '450']
            && $template['components'][1]['parameters'][0]['text'] === $order->track_token;
    });
    expect(OutboundMessage::query()->sole())
        ->order_id->toBe($order->id)
        ->purpose->toBe(MessagePurpose::OrderReceived);
    Mail::assertNothingSent();
});

it('emails the customer when they gave an email, in the store\'s name', function () {
    cnWhatsappOn();
    Mail::fake();
    Http::fake();
    $order = cnOrder(cnTenant(), ['customer_email' => 'sara@example.com', 'whatsapp_opt_in' => true]);

    app(CustomerNotices::class)->received($order);

    Mail::assertSent(CustomerOrderMail::class, fn (CustomerOrderMail $mail) => $mail->hasTo('sara@example.com')
        && $mail->store === 'متجر حبة'
        && str_contains($mail->heading, '1024')
        && $mail->actionUrl === PublicSite::url('platform.test').'t/'.$order->track_token);
    Http::assertNothingSent();
    expect(OutboundMessage::query()->sole())->channel->toBe('email')->recipient->toBe('sara@example.com');
});

it('sends nothing without an email or WhatsApp consent', function () {
    cnWhatsappOn();
    Mail::fake();
    Http::fake();

    app(CustomerNotices::class)->received(cnOrder(cnTenant()));

    Http::assertNothingSent();
    Mail::assertNothingSent();
    expect(OutboundMessage::query()->count())->toBe(0);
});

it('follows the customer\'s own choice, and falls back to email when WhatsApp fails', function () {
    cnWhatsappOn();
    Mail::fake();
    Http::fake([CN_GRAPH.'/*' => Http::response(['error' => ['code' => 132001, 'message' => 'Template does not exist']], 404)]);
    $tenant = cnTenant();
    $customer = asTenant($tenant, fn () => Customer::query()->create(['phone' => '+201011112222', 'email' => 'sara@example.com', 'notify_channel' => 'whatsapp']));
    $order = cnOrder($tenant, ['customer_id' => $customer->id]);

    app(CustomerNotices::class)->received($order);

    Http::assertSentCount(1);
    Mail::assertSent(CustomerOrderMail::class, fn (CustomerOrderMail $mail) => $mail->hasTo('sara@example.com'));
    expect(OutboundMessage::query()->where('order_id', $order->id)->pluck('channel')->all())->toBe(['whatsapp', 'email']);
});

it('tells the customer when the order ships, is cancelled or delivered (not for other steps)', function () {
    Mail::fake();
    $tenant = cnTenant();
    $order = cnOrder($tenant, ['customer_email' => 'sara@example.com', 'status' => OrderStatus::New, 'shipping_company_name' => 'بوسطة']);

    asTenant($tenant, function () use ($order) {
        app(ChangeOrderStatus::class)->handle($order, OrderStatus::Confirmed, null, null);
        app(ChangeOrderStatus::class)->handle($order->refresh(), OrderStatus::Shipped, null, null, ['tracking_number' => 'BX-77']);
    });

    Mail::assertSentCount(1);
    Mail::assertSent(CustomerOrderMail::class, fn (CustomerOrderMail $mail) => $mail->event === 'shipped'
        && str_contains($mail->intro, 'بوسطة')
        && in_array('BX-77', array_column($mail->rows, 'value'), true));
});

it('turns the short link into the store\'s tracking page, and tracks by token', function () {
    $tenant = cnTenant();
    $order = cnOrder($tenant);

    $this->getJson('/api/v1/public/track-link?token='.$order->track_token, internalHeaders())->assertOk()
        ->assertJsonPath('data.url', PublicSite::url(CN_HOST).'track?t='.$order->track_token);
    $this->getJson('/api/v1/public/track-link?token=aaaaaaaaaaaa', internalHeaders())->assertNotFound();
    $this->getJson('/api/v1/public/track-link?token=bad', internalHeaders())->assertStatus(422);
    $this->getJson('/api/v1/public/track-link?token='.$order->track_token)->assertUnauthorized();

    $this->postJson('/api/v1/public/track', ['host' => CN_HOST, 'token' => $order->track_token], internalHeaders())->assertOk()
        ->assertJsonPath('data.order_number', 1024);
    $this->postJson('/api/v1/public/track', ['host' => CN_HOST], internalHeaders())->assertStatus(422)->assertJsonValidationErrors(['order_number', 'phone']);
});

it('never tracks another store\'s order by its token', function () {
    $other = Tenant::factory()->create();
    $foreign = cnOrder($other);
    cnTenant();

    $this->postJson('/api/v1/public/track', ['host' => CN_HOST, 'token' => $foreign->track_token], internalHeaders())->assertNotFound();
});

it('shows the store owner what the customer was told', function () {
    Mail::fake();
    $owner = createOwner();
    $order = asTenant($owner, fn () => Order::factory()->create(['customer_email' => 'sara@example.com']));
    app(CustomerNotices::class)->received($order);
    actingAsOwner($owner);

    $this->getJson('/api/v1/dashboard/orders/'.$order->id)->assertOk()
        ->assertJsonPath('data.customer_messages.0.purpose', 'order_received')
        ->assertJsonPath('data.customer_messages.0.channel', 'email')
        ->assertJsonPath('data.customer_messages.0.status', 'sent');
});
