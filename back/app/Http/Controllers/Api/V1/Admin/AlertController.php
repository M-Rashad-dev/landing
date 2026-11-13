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
use App\Services\AdminAlerts;
use Illuminate\Http\JsonResponse;
use Throwable;

/** Email alerts to the platform owner: where they go, which ones, and a test send. */
final class AlertController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly AdminAlerts $alerts) {}

    public function show(): JsonResponse
    {
        return $this->ok([
            'email' => $this->alerts->email(),
            'events' => $this->alerts->events(),
            'available' => AdminAlert::values(),
            'mail_ready' => AdminAlerts::mailReady(),
        ]);
    }

    public function update(AdminAlertsRequest $request, PlatformSettings $settings, ManageTenant $audit): JsonResponse
    {
        $data = $request->validated();
        $email = isset($data['email']) && $data['email'] !== '' ? mb_strtolower(trim((string) $data['email'])) : null;
        $events = array_values(array_intersect(AdminAlert::values(), $data['events']));

        $settings->save(['alert_email' => $email, 'alert_events' => $events]);
        $audit->audit('alerts.update', 'platform', ['email' => $email, 'events' => $events], 'settings');

        return $this->show();
    }

    public function test(): JsonResponse
    {
        $email = $this->alerts->email() ?? throw new ApiException(422, 'alert_email_missing', __('alerts.email_missing'));

        try {
            $this->alerts->sendTest($email);
        } catch (Throwable $e) {
            report($e);

            throw new ApiException(422, 'mail_failed', __('alerts.send_failed'));
        }

        return $this->ok(['sent_to' => $email, 'mail_ready' => AdminAlerts::mailReady()]);
    }
}
