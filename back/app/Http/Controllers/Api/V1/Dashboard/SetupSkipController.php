<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Tenancy\Tenancy;
use Illuminate\Http\Response;

/** «تخطي» on an optional step of the home checklist (only the custom domain is optional). */
final class SetupSkipController extends Controller
{
    use RespondsWithJson;

    public const SKIPPABLE = ['domain'];

    public function __invoke(string $step): Response
    {
        abort_unless(in_array($step, self::SKIPPABLE, true), 404);

        $tenant = Tenant::query()->findOrFail((int) Tenancy::id());
        $skipped = (array) ($tenant->settings['setup_skipped'] ?? []);
        $tenant->settings = array_merge($tenant->settings ?? [], ['setup_skipped' => array_values(array_unique([...$skipped, $step]))]);
        $tenant->save();

        return $this->noContent();
    }
}
