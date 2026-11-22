<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\CustomerUpload;
use App\Models\Order;
use App\Store\CustomerUploads;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** An image / file the customer uploaded on a «حسب الطلب» field of this order, as a download. */
final class OrderUploadController extends Controller
{
    public function show(Order $order, int $upload, CustomerUploads $uploads): BinaryFileResponse
    {
        $file = CustomerUpload::query()
            ->whereKey($upload)
            ->whereHas('orderItem', fn ($q) => $q->where('order_id', $order->id))
            ->firstOrFail();

        // Always a download, never shown inline (the type came from a visitor).
        return response()->download($uploads->absolutePath($file), $file->name, [
            'Content-Type' => $file->mime,
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
