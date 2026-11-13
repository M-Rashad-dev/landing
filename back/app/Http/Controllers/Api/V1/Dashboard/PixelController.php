<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Tenant;
use App\Support\Pixels;
use App\Support\TrackingIds;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** «البيكسلات»: the store's tracking ids and the one set every landing page listens to. */
final class PixelController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly Pixels $pixels) {}

    public function show(): JsonResponse
    {
        return $this->ok($this->pixels->settings($this->tenant()));
    }

    public function update(Request $request): JsonResponse
    {
        // Same clean-up as everywhere ids are typed: trimmed, the case-insensitive ones upper-cased.
        $input = [];
        foreach (['store', 'landing'] as $group) {
            $values = $request->input($group);
            if (is_array($values)) {
                foreach ($values as $key => $value) {
                    $input[$group][$key] = TrackingIds::normalize((string) $key, $value);
                }
            }
        }
        $request->merge($input);

        $data = $request->validate(array_merge(
            TrackingIds::rules('store'),
            TrackingIds::rules('landing'),
            ['landing_same' => ['required', 'boolean']],
        ));

        $tenant = $this->tenant();
        $this->pixels->save($tenant, $data);
        RevalidateTenantHosts::dispatch($tenant->id)->afterCommit();

        return $this->ok($this->pixels->settings($tenant->refresh()));
    }

    private function tenant(): Tenant
    {
        return Tenant::query()->findOrFail(Tenancy::id());
    }
}
