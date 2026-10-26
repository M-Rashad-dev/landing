<?php

declare(strict_types=1);

namespace App\Exceptions;

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

    public function render(): JsonResponse
    {
        $body = ['message' => $this->getMessage(), 'code' => $this->errorCode];

        if ($this->errors !== null) {
            $body['errors'] = $this->errors;
        }

        return new JsonResponse(array_merge($body, $this->extra), $this->status);
    }
}
