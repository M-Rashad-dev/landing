<?php

declare(strict_types=1);

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;
use Throwable;

/**
 * Renders every error on api/*, internal/* and /health as
 * { message, code, errors? } with Arabic messages and no leaked internals.
 */
final class ApiExceptionRenderer
{
    public static function shouldRender(Request $request): bool
    {
        return $request->is('api/*', 'internal/*', 'health', 'media/*') || $request->expectsJson();
    }

    public function __invoke(Throwable $e, Request $request): ?JsonResponse
    {
        if (! self::shouldRender($request)) {
            return null;
        }

        return match (true) {
            $e instanceof ValidationException => $this->json(422, 'validation_failed', __('landing.validation_failed'), [
                'errors' => $e->errors(),
            ]),
            $e instanceof AuthenticationException => $this->json(401, 'unauthenticated', __('landing.unauthenticated')),
            $e instanceof AccessDeniedHttpException => $this->json(403, 'forbidden', __('landing.forbidden')),
            $e instanceof NotFoundHttpException => $this->json(404, 'not_found', __('landing.not_found')),
            $e instanceof MethodNotAllowedHttpException => $this->json(405, 'method_not_allowed', __('landing.method_not_allowed')),
            $e instanceof ThrottleRequestsException, $e instanceof TooManyRequestsHttpException => $this->json(
                429,
                'too_many_requests',
                __('landing.too_many_requests'),
                [],
                $e->getHeaders(),
            ),
            $e instanceof HttpExceptionInterface => $this->json(
                $e->getStatusCode(),
                $this->codeForStatus($e->getStatusCode()),
                $this->messageForStatus($e->getStatusCode()),
                [],
                $e->getHeaders(),
            ),
            default => $this->serverError($e),
        };
    }

    private function serverError(Throwable $e): JsonResponse
    {
        $extra = config('app.debug') ? ['debug' => ['exception' => $e::class, 'message' => $e->getMessage()]] : [];

        return $this->json(500, 'server_error', __('landing.server_error'), $extra);
    }

    /**
     * @param  array<string, mixed>  $extra
     * @param  array<string, string>  $headers
     */
    private function json(int $status, string $code, string $message, array $extra = [], array $headers = []): JsonResponse
    {
        return new JsonResponse(array_merge(['message' => $message, 'code' => $code], $extra), $status, $headers);
    }

    private function codeForStatus(int $status): string
    {
        return match ($status) {
            401 => 'unauthenticated',
            403 => 'forbidden',
            404 => 'not_found',
            409 => 'conflict',
            422 => 'validation_failed',
            429 => 'too_many_requests',
            default => $status >= 500 ? 'server_error' : 'http_error',
        };
    }

    private function messageForStatus(int $status): string
    {
        return match ($status) {
            401 => __('landing.unauthenticated'),
            403 => __('landing.forbidden'),
            404 => __('landing.not_found'),
            409 => __('landing.conflict'),
            422 => __('landing.validation_failed'),
            429 => __('landing.too_many_requests'),
            default => __('landing.server_error'),
        };
    }
}
