<?php

declare(strict_types=1);

namespace App\Http\Controllers\Concerns;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Http\Response;

/** Unified response shape: { data, meta? }. */
trait RespondsWithJson
{
    /** @param array<string, mixed> $meta */
    protected function ok(mixed $data, array $meta = [], int $status = 200): JsonResponse
    {
        if ($data instanceof JsonResource) {
            $data = $data->resolve(request());
        }

        $body = ['data' => $data];

        if ($meta !== []) {
            $body['meta'] = $meta;
        }

        return new JsonResponse($body, $status);
    }

    protected function created(mixed $data): JsonResponse
    {
        return $this->ok($data, [], 201);
    }

    protected function noContent(): Response
    {
        return response()->noContent();
    }

    /**
     * @param  LengthAwarePaginator<int, mixed>  $paginator
     * @param  class-string<JsonResource>  $resource
     * @param  array<string, mixed>  $extraMeta
     */
    protected function paginated(LengthAwarePaginator $paginator, string $resource, array $extraMeta = []): JsonResponse
    {
        return $this->ok(
            $resource::collection($paginator->getCollection())->resolve(request()),
            array_merge([
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ], $extraMeta),
        );
    }

    protected function perPage(Request $request): int
    {
        $perPage = (int) $request->query('per_page', '20');

        return max(1, min(100, $perPage));
    }
}
