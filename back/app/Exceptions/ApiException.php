<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Enums\PlanFeature;
use App\Enums\PlanLimit;
use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * An error with an explicit HTTP status and machine-readable code,
 * rendered as { message, code, errors?, ...extra }.
 */
class ApiException extends RuntimeException
{
    /**
     * @param  array<string, list<string>>|null  $errors
     * @param  array<string, mixed>  $extra
     */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly ?array $errors = null,
        public readonly array $extra = [],
    ) {
        parent::__construct($message);
    }

    public static function forbidden(string $code = 'forbidden', ?string $message = null): self
    {
        return new self(403, $code, $message ?? __('landing.forbidden'));
    }

    /** @param array<string, mixed> $extra */
    public static function conflict(string $code, string $message, array $extra = []): self
    {
        return new self(409, $code, $message, null, $extra);
    }

    public static function limitReached(int $limit): self
    {
        return new self(422, 'limit_reached', __('landing.limit_reached', ['limit' => $limit]));
    }

    /** @param array{key: string, name: string}|null $upgradeTo cheapest plan with more room */
    public static function planLimitReached(PlanLimit $limit, int $max, int $used, ?array $upgradeTo): self
    {
        return new self(403, 'plan_limit_reached', __('billing.limit_reached', ['label' => $limit->label(), 'limit' => $max]), null, [
            'limit_key' => $limit->value,
            'limit' => $max,
            'used' => $used,
            'upgrade_to' => $upgradeTo,
        ]);
    }

    /** @param array{key: string, name: string}|null $upgradeTo cheapest plan with the feature */
    public static function planFeatureLocked(PlanFeature $feature, ?array $upgradeTo): self
    {
        return new self(403, 'plan_feature_locked', __('billing.feature_locked', ['label' => $feature->label()]), null, [
            'feature' => $feature->value,
            'upgrade_to' => $upgradeTo,
        ]);
    }

    public static function subscriptionExpired(): self
    {
        return new self(403, 'subscription_expired', __('billing.subscription_expired'));
    }

    public function render(): JsonResponse
    {
        $body = ['message' => $this->getMessage(), 'code' => $this->errorCode];

        if ($this->errors !== null) {
            $body['errors'] = $this->errors;
        }

        return new JsonResponse(array_merge($body, $this->extra), $this->status);
    }
}
