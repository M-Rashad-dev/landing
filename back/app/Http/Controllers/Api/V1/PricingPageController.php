<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Billing\PlanPresenter;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

/** Public plans and prices for the marketing pricing page (no sign-in). */
final class PricingPageController extends Controller
{
    use RespondsWithJson;

    public function __invoke(PlanPresenter $presenter): JsonResponse
    {
        return $this->ok($presenter->pricing(), ['entitlements' => PlanPresenter::entitlementCatalog()])
            ->header('Cache-Control', 'public, max-age=60');
    }
}
