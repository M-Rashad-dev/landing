<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\StoreMailRequest;
use App\Http\Resources\StoreMailSettingResource;
use App\Mail\Store\MailboxError;
use App\Mail\Store\StoreMailSettings;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** «الإعدادات» → «الإيميلات»: how the store's customer emails go out. */
final class StoreMailController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly StoreMailSettings $settings) {}

    public function show(): JsonResponse
    {
        return $this->ok(StoreMailSettingResource::make($this->settings->current()));
    }

    public function update(StoreMailRequest $request): JsonResponse
    {
        return $this->ok(StoreMailSettingResource::make($this->settings->save($request->validated())));
    }

    /** «امسح بيانات إيميلي»: the mailbox and its password are deleted. */
    public function forget(): JsonResponse
    {
        return $this->ok(StoreMailSettingResource::make($this->settings->forget()));
    }

    /** «ابعت إيميل تجربة» to the address given (default: the merchant's login email). */
    public function test(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $to = (string) ($request->validate(['to' => ['nullable', 'email:rfc', 'max:191']])['to'] ?? $user->email);
        try {
            $via = $this->settings->test($to);
        } catch (MailboxError $e) {
            throw new ApiException(422, 'mailbox_failed', $e->getMessage());
        }

        return $this->ok(['via' => $via->value, 'to' => $to, 'settings' => StoreMailSettingResource::make($this->settings->current())]);
    }
}
