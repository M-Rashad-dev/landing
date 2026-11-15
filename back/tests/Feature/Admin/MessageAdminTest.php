<?php

declare(strict_types=1);

use App\Enums\MessagePurpose;
use App\Enums\MessageStatus;
use App\Messaging\WhatsApp\WhatsAppTemplates;
use App\Models\AdminAuditLog;
use App\Models\OutboundMessage;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

const ADMIN_GRAPH = 'https://graph.facebook.com/v23.0';

function adminWhatsappOn(): void
{
    config([
        'services.whatsapp.token' => 't', 'services.whatsapp.phone_number_id' => '111', 'services.whatsapp.waba_id' => '222',
        'services.whatsapp.graph_url' => ADMIN_GRAPH,
    ]);
}

function logMessage(array $attributes = []): OutboundMessage
{
    return OutboundMessage::query()->create($attributes + ['channel' => 'whatsapp', 'recipient' => '+201012345678', 'purpose' => MessagePurpose::CustomerCode, 'status' => MessageStatus::Delivered]);
}

beforeEach(function () {
    Sanctum::actingAs(User::factory()->superAdmin()->create());
});

it('shows the number, the templates and how messages ended', function () {
    adminWhatsappOn();
    Http::fake([
        ADMIN_GRAPH.'/111*' => Http::response(['display_phone_number' => '+20 10 91152636', 'verified_name' => 'Mksab', 'name_status' => 'APPROVED', 'quality_rating' => 'GREEN']),
        ADMIN_GRAPH.'/222/message_templates*' => Http::response(['data' => [
            ['name' => WhatsAppTemplates::CODE, 'language' => 'ar', 'status' => 'APPROVED', 'category' => 'AUTHENTICATION'],
            ['name' => WhatsAppTemplates::name('order_received'), 'language' => 'ar', 'status' => 'REJECTED', 'category' => 'UTILITY', 'rejected_reason' => 'INVALID_FORMAT'],
        ]]),
    ]);
    logMessage(['status' => MessageStatus::Read]);
    logMessage(['status' => MessageStatus::Delivered]);
    logMessage(['status' => MessageStatus::Failed]);
    logMessage(['status' => MessageStatus::Read])->forceFill(['created_at' => now()->subDays(40)])->save();

    $res = $this->getJson('/api/v1/admin/messages/overview')->assertOk()
        ->assertJsonPath('data.configured', true)
        ->assertJsonPath('data.phone.name', 'Mksab')
        ->assertJsonPath('data.phone.quality', 'GREEN')
        ->assertJsonPath('data.month', ['total' => 3, 'delivered' => 2, 'read' => 1, 'failed' => 1]);

    $templates = collect($res->json('data.templates'))->keyBy('name');
    expect($templates)->toHaveCount(count(WhatsAppTemplates::names()))
        ->and($templates[WhatsAppTemplates::CODE]['status'])->toBe('APPROVED')
        ->and($templates[WhatsAppTemplates::name('order_received')]['rejected_reason'])->toBe('INVALID_FORMAT')
        ->and($templates[WhatsAppTemplates::name('order_shipped')]['status'])->toBe('MISSING');
});

it('says so when WhatsApp is not connected, and when Meta refuses', function () {
    $this->getJson('/api/v1/admin/messages/overview')->assertOk()->assertJsonPath('data.configured', false)->assertJsonPath('data.phone', null);
    $this->postJson('/api/v1/admin/messages/templates')->assertStatus(409)->assertJsonPath('code', 'whatsapp_not_configured');

    adminWhatsappOn();
    Http::fake([ADMIN_GRAPH.'/*' => Http::response(['error' => ['code' => 190, 'message' => 'Invalid OAuth access token']], 401)]);
    $this->getJson('/api/v1/admin/messages/overview')->assertOk()->assertJsonPath('data.error', 'Invalid OAuth access token');
});

it('lists the message log with filters', function () {
    $tenant = Tenant::factory()->create(['name' => 'متجر حبة']);
    logMessage(['tenant_id' => $tenant->id, 'status' => MessageStatus::Failed, 'error_title' => 'Not on WhatsApp']);
    logMessage(['recipient' => '+201099998888', 'purpose' => MessagePurpose::AutoReply]);

    $this->getJson('/api/v1/admin/messages')->assertOk()->assertJsonCount(2, 'data');
    $this->getJson('/api/v1/admin/messages?status=failed')->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.tenant.name', 'متجر حبة')->assertJsonPath('data.0.error', 'Not on WhatsApp');
    $this->getJson('/api/v1/admin/messages?purpose=auto_reply')->assertOk()->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/admin/messages?phone=01099998888')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.recipient', '+201099998888');
    $this->getJson('/api/v1/admin/messages?status=lost')->assertStatus(422)->assertJsonValidationErrors('status');
});

it('submits the missing templates from the admin and logs it', function () {
    adminWhatsappOn();
    Http::fake([
        ADMIN_GRAPH.'/222/message_templates*' => fn (Request $request) => $request->method() === 'GET'
            ? Http::response(['data' => []])
            : Http::response(['id' => '9', 'status' => 'PENDING']),
    ]);

    $this->postJson('/api/v1/admin/messages/templates')->assertOk()
        ->assertJsonCount(count(WhatsAppTemplates::names()), 'data.submitted')
        ->assertJsonPath('data.errors', []);

    expect(AdminAuditLog::query()->where('action', 'whatsapp.templates_push')->exists())->toBeTrue();
});

it('is for the super admin only', function () {
    Sanctum::actingAs(createOwner());
    $this->getJson('/api/v1/admin/messages')->assertForbidden();
    $this->getJson('/api/v1/admin/messages/overview')->assertForbidden();

    $this->app['auth']->forgetGuards();
    $this->withHeaders(['Authorization' => ''])->getJson('/api/v1/admin/messages')->assertUnauthorized();
});
