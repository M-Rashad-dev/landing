<?php

declare(strict_types=1);

namespace App\Messaging\WhatsApp;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/** Meta's WhatsApp Cloud API over HTTPS (config/services.php → whatsapp). Tests use Http::fake(). */
final class CloudWhatsAppGateway implements WhatsAppGateway
{
    public function configured(): bool
    {
        return $this->token() !== '' && $this->phoneNumberId() !== '' && $this->wabaId() !== '';
    }

    public function sendTemplate(string $to, string $name, string $language, array $components): string
    {
        $template = ['name' => $name, 'language' => ['code' => $language]];
        if ($components !== []) {
            $template['components'] = $components;
        }

        return $this->send(['to' => self::digits($to), 'type' => 'template', 'template' => $template]);
    }

    public function sendText(string $to, string $body): string
    {
        return $this->send(['to' => self::digits($to), 'type' => 'text', 'text' => ['preview_url' => false, 'body' => $body]]);
    }

    public function templates(): array
    {
        $json = $this->call(fn (PendingRequest $http): Response => $http->get($this->url($this->wabaId().'/message_templates'), [
            'fields' => 'name,language,status,category,rejected_reason',
            'limit' => 200,
        ]));

        $out = [];
        foreach ((array) ($json['data'] ?? []) as $row) {
            if (! is_array($row)) {
                continue;
            }
            $reason = $row['rejected_reason'] ?? null;
            $out[] = [
                'name' => (string) ($row['name'] ?? ''),
                'language' => (string) ($row['language'] ?? ''),
                'status' => (string) ($row['status'] ?? ''),
                'category' => (string) ($row['category'] ?? ''),
                'rejected_reason' => is_string($reason) && $reason !== '' && $reason !== 'NONE' ? $reason : null,
            ];
        }

        return $out;
    }

    public function createTemplate(array $definition): string
    {
        $json = $this->call(fn (PendingRequest $http): Response => $http->post($this->url($this->wabaId().'/message_templates'), $definition));

        return (string) ($json['status'] ?? 'PENDING');
    }

    public function phoneNumber(): array
    {
        $json = $this->call(fn (PendingRequest $http): Response => $http->get($this->url($this->phoneNumberId()), [
            'fields' => 'display_phone_number,verified_name,name_status,quality_rating',
        ]));

        return [
            'number' => (string) ($json['display_phone_number'] ?? ''),
            'name' => (string) ($json['verified_name'] ?? ''),
            'name_status' => (string) ($json['name_status'] ?? ''),
            'quality' => (string) ($json['quality_rating'] ?? ''),
        ];
    }

    /** @param array<string, mixed> $payload */
    private function send(array $payload): string
    {
        $json = $this->call(fn (PendingRequest $http): Response => $http->post(
            $this->url($this->phoneNumberId().'/messages'),
            ['messaging_product' => 'whatsapp', 'recipient_type' => 'individual'] + $payload,
        ));

        $id = $json['messages'][0]['id'] ?? null;
        if (! is_string($id) || $id === '') {
            throw new WhatsAppError('no_id', 'Meta accepted the message without an id');
        }

        return $id;
    }

    /**
     * @param  callable(PendingRequest): Response  $request
     * @return array<string, mixed>
     */
    private function call(callable $request): array
    {
        if (! $this->configured()) {
            throw new WhatsAppError('not_configured', 'WhatsApp keys are missing');
        }

        try {
            $response = $request(Http::withToken($this->token())->acceptJson()->timeout(15)->connectTimeout(5));
        } catch (ConnectionException $e) {
            throw new WhatsAppError('network', $e->getMessage());
        }

        $json = $response->json();
        $json = is_array($json) ? $json : [];
        if ($response->failed()) {
            $error = is_array($json['error'] ?? null) ? $json['error'] : [];
            $details = $error['error_data']['details'] ?? null;
            throw new WhatsAppError(
                (string) ($error['code'] ?? $response->status()),
                mb_substr((string) (is_string($details) && $details !== '' ? $details : ($error['message'] ?? 'HTTP '.$response->status())), 0, 250),
            );
        }

        return $json;
    }

    private function url(string $path): string
    {
        return rtrim((string) config('services.whatsapp.graph_url'), '/').'/'.$path;
    }

    private function token(): string
    {
        return (string) config('services.whatsapp.token');
    }

    private function phoneNumberId(): string
    {
        return (string) config('services.whatsapp.phone_number_id');
    }

    private function wabaId(): string
    {
        return (string) config('services.whatsapp.waba_id');
    }

    /** Meta wants the number without "+". */
    private static function digits(string $e164): string
    {
        return ltrim($e164, '+');
    }
}
