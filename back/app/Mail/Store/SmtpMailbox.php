<?php

declare(strict_types=1);

namespace App\Mail\Store;

use App\Models\StoreMailSetting;
use App\Services\Dns\DnsResolver;
use App\Services\Webhooks\OutboundUrl;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Contracts\View\Factory;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailer;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;
use Symfony\Component\Mailer\Transport\Smtp\Stream\SocketStream;
use Throwable;

/**
 * SMTP to the merchant's mail server. The host must resolve to public addresses only (no reaching our own
 * network through it) and the connection is pinned to the checked address, with the certificate still checked
 * against the host name. 15 seconds at most per step.
 */
final class SmtpMailbox implements Mailbox
{
    public function __construct(private readonly DnsResolver $dns, private readonly Factory $views, private readonly Dispatcher $events) {}

    public function check(StoreMailSetting $settings): void
    {
        $transport = $this->transport($settings);
        try {
            $transport->start();
            $transport->stop();
        } catch (Throwable $e) {
            throw MailboxError::from($e);
        }
    }

    public function send(StoreMailSetting $settings, string $to, Mailable $mail): void
    {
        $transport = $this->transport($settings);
        try {
            (new Mailer('store', $this->views, $transport, $this->events))->to($to)->send($mail);
        } catch (Throwable $e) {
            throw MailboxError::from($e);
        } finally {
            try {
                $transport->stop();
            } catch (Throwable) {
                // Already closed.
            }
        }
    }

    private function transport(StoreMailSetting $settings): EsmtpTransport
    {
        $host = strtolower(trim((string) $settings->smtp_host));
        $ips = filter_var($host, FILTER_VALIDATE_IP) !== false ? [$host] : $this->dns->ipv4($host);
        if ($ips === []) {
            throw new MailboxError((string) __('store_mail.errors.host'));
        }
        foreach ($ips as $ip) {
            if (! OutboundUrl::isPublicIp($ip)) {
                throw new MailboxError((string) __('store_mail.errors.private_host'));
            }
        }

        $transport = new EsmtpTransport($ips[0], (int) $settings->smtp_port, $settings->smtp_encryption === 'ssl');
        if ($settings->smtp_encryption === 'tls') {
            $transport->setRequireTls(true);
        }
        $transport->setUsername((string) $settings->smtp_username);
        $transport->setPassword((string) $settings->smtp_password);
        $transport->setLocalDomain((string) (parse_url((string) config('app.url'), PHP_URL_HOST) ?: 'localhost'));

        $stream = $transport->getStream();
        if ($stream instanceof SocketStream) {
            $stream->setTimeout(15);
            $stream->setStreamOptions(['ssl' => ['peer_name' => $host, 'verify_peer' => true, 'verify_peer_name' => true]]);
        }

        return $transport;
    }
}
