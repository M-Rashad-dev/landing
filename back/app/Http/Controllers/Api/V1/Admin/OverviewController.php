<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Services\PlatformStats;
use Illuminate\Http\JsonResponse;

/** Admin home: stores, subscriptions, platform money, store activity, last 30 days, top stores. */
final class OverviewController extends Controller
{
    use RespondsWithJson;

    public function __invoke(PlatformStats $stats): JsonResponse
    {
        return $this->ok($stats->overview());
    }
}
