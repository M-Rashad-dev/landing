<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\PricingPreviewRequest;
use App\Models\Product;
use App\Pricing\PriceCalculator;
use App\Support\CairoTime;
use Illuminate\Http\JsonResponse;

final class PricingController extends Controller
{
    /** Price simulator for the dashboard: same PriceCalculator, optional simulated time `at` (Cairo). */
    public function preview(PricingPreviewRequest $request, PriceCalculator $calculator): JsonResponse
    {
        $product = Product::query()->with('options.values')->findOrFail((int) $request->validated('product_id'));
        $at = CairoTime::parse($request->validated('at')) ?? now();

        $quote = $calculator->quote(
            $product,
            (int) $request->validated('quantity'),
            (array) $request->validated('options', []),
            $at,
            $request->validated('code'),
            $request->validated('phone'),
        );

        return $this->ok($quote->toArray() + ['at' => $at->toIso8601ZuluString()]);
    }
}
