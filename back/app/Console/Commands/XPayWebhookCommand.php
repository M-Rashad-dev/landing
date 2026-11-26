<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Billing\Payments\XPay\XPayClient;
use App\Billing\Payments\XPay\XPayError;
use Illuminate\Console\Command;

/**
 * Registers the platform's XPay webhook (invoices paid online) on the account of XPAY_SECRET_KEY — run once after
 * putting a new key (test → live). It prints the signing secret to put in XPAY_WEBHOOK_SECRET; XPay never shows it
 * again.
 */
final class XPayWebhookCommand extends Command
{
    protected $signature = 'xpay:webhook {url : the public webhook address, e.g. https://app.mksab.store/api/webhooks/xpay}';

    protected $description = 'Register the platform XPay webhook and print its signing secret';

    /** What settles an invoice: paid, paid later at a kiosk (Fawry), failed, expired. */
    public const EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired'];

    public function handle(XPayClient $xpay): int
    {
        $url = (string) $this->argument('url');
        if (filter_var($url, FILTER_VALIDATE_URL) === false || ! str_starts_with($url, 'https://')) {
            $this->error('The webhook address must be a full https:// URL.');

            return self::INVALID;
        }
        if (! $xpay->configured()) {
            $this->error('XPay is not configured: set XPAY_SECRET_KEY first.');

            return self::FAILURE;
        }
        try {
            $endpoint = $xpay->registerWebhook($url, self::EVENTS);
        } catch (XPayError $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }
        $this->info('Registered ('.($endpoint['livemode'] ? 'live' : 'test').'), id '.$endpoint['id'].'.');
        $this->line('Put this in .env, then restart the app:');
        $this->line('XPAY_WEBHOOK_SECRET='.$endpoint['secret']);

        return self::SUCCESS;
    }
}
