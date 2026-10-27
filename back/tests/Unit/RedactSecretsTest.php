<?php

declare(strict_types=1);

use App\Logging\RedactSecrets;
use Monolog\Formatter\JsonFormatter;
use Monolog\Level;
use Monolog\LogRecord;

it('redacts secret-looking keys at any depth and keeps the rest', function () {
    $record = new LogRecord(new DateTimeImmutable, 'app', Level::Warning, 'login', [
        'password' => 'hunter22',
        'user_id' => 5,
        'headers' => ['Authorization' => 'Bearer abc', 'X-Internal-Key' => 'k', 'accept' => 'json'],
        'temporary_password' => 'Xy7#kLm2Qp9!',
        'token' => 'plain',
    ], ['session_id' => 's1', 'host' => 'shop.test']);

    $out = (new RedactSecrets)($record);

    expect($out->context)->toBe([
        'password' => '[redacted]',
        'user_id' => 5,
        'headers' => ['Authorization' => '[redacted]', 'X-Internal-Key' => '[redacted]', 'accept' => 'json'],
        'temporary_password' => '[redacted]',
        'token' => '[redacted]',
    ])->and($out->extra)->toBe(['session_id' => '[redacted]', 'host' => 'shop.test']);
});

it('writes JSON lines through the json channel', function () {
    $channel = config('logging.channels.json');

    expect($channel['formatter'])->toBe(JsonFormatter::class)
        ->and($channel['handler_with']['stream'])->toBe('php://stderr')
        ->and($channel['processors'])->toContain(RedactSecrets::class);
});
