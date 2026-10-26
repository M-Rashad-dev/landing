<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

final class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $checks = ['database' => false, 'cache' => false];

        try {
            DB::select('select 1');
            $checks['database'] = true;
        } catch (Throwable $e) {
            Log::warning('health: database check failed', ['error' => $e->getMessage()]);
        }

        try {
            Cache::store()->put('health:ping', '1', 10);
            $checks['cache'] = Cache::store()->get('health:ping') === '1';
        } catch (Throwable $e) {
            Log::warning('health: cache check failed', ['error' => $e->getMessage()]);
        }

        $healthy = ! in_array(false, $checks, true);

        return new JsonResponse(['status' => $healthy ? 'ok' : 'degraded', 'checks' => $checks], $healthy ? 200 : 503);
    }
}
