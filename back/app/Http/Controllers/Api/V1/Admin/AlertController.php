<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\ManageTenant;
use App\Billing\PlatformSettings;
use App\Enums\AdminAlert;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminAlertsRequest;
use App\Messaging\WhatsApp\WhatsAppGateway;
use App\Models\User;
use App\Services\AdminAlerts;
use App\Services\PhoneNormalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

/**
 * Alerts to the platform owner (the bell always gets them): which ones also go out, on WhatsApp
 * or email, to which phone / email (empty = the signed-in admin's own), and a test email.
 */
final class AlertController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly AdminAlerts $alerts, private readonly PlatformSettings $settings) {}

    public function show(Request $request, WhatsAppGateway $whatsapp): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $all = $this->settings->all();

        return $this->ok([
            'channel' => (string) ($all['alert_channel'] ?? 'whatsapp'),
            'phone' => $all['alert_phone'] ?: null,
            'email' => $all['alert_email'] ?: null,
            'own_phone' => $admin->phone,
            'own_email' => $admin->email,
            'events' => $this->alerts->events(),
            'available' => AdminAlert::values(),
            'mail_ready' => AdminAlerts::mailReady(),
            'whatsapp_ready' => $whatsapp->configured(),
        ]);
    }

    public function update(AdminAlertsRequest $request, ManageTenant $audit, PhoneNormalizer $phones, WhatsAppGateway $whatsapp): JsonResponse
    {
        $data = $request->validated();
        $email = isset($data['email']) && $data['email'] !== '' ? mb_strtolower(trim((string) $data['email'])) : null;
        $phone = isset($data['phone']) && $data['phone'] !== '' ? $phones->normalize((string) $data['phone']) : null;
        $events = array_values(array_intersect(AdminAlert::values(), $data['events']));

        $this->settings->save(['alert_channel' => $data['channel'], 'alert_phone' => $phone, 'alert_email' => $email, 'alert_events' => $events]);
        $audit->audit('alerts.update', 'platform', ['channel' => $data['channel'], 'phone' => $phone, 'email' => $email, 'events' => $events], 'settings');

        return $this->show($request, $whatsapp);
    }

    public function test(Request $request): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $email = $this->settings->all()['alert_email'] ?: $admin->email;
        if (! is_string($email) || $email === '') {
            throw new ApiException(422, 'alert_email_missing', __('alerts.email_missing'));
        }

        try {
            $this->alerts->sendTest($email);
        } catch (Throwable $e) {
            report($e);

            throw new ApiException(422, 'mail_failed', __('alerts.send_failed'));
        }

        return $this->ok(['sent_to' => $email, 'mail_ready' => AdminAlerts::mailReady()]);
    }
}
