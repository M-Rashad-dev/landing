<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Webhooks;

use App\Billing\Payments\OnlinePayments;
use App\Billing\Payments\XPay\XPayError;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * XPay's webhook (relayed by Next with the raw body and XPay-Signature untouched): checkout.session events settle the
 * session from XPay itself. 403 on a bad signature; 500 when XPay can't be asked back, so XPay delivers it again.
 */
final class XPayWebhookController extends Controller
{
    public function receive(Request $request, OnlinePayments $online): Response
    {
        try {
            $valid = $online->webhook($request->getContent(), (string) $request->header('XPay-Signature', ''));
        } catch (XPayError $e) {
            report($e);

            return response('', 500);
        }

        return response('', $valid ? 200 : 403);
    }
}
