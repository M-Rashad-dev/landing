<?php

declare(strict_types=1);

namespace App\Logging;

use Monolog\LogRecord;
use Monolog\Processor\ProcessorInterface;

/** Replaces values of secret-looking keys (password, token, key, secret, cookie...) in log context. */
final class RedactSecrets implements ProcessorInterface
{
    private const PATTERN = '/pass(word)?|token|secret|api[_-]?key|internal[_-]?key|authorization|cookie|session/i';

    public function __invoke(LogRecord $record): LogRecord
    {
        return $record->with(context: $this->redact($record->context), extra: $this->redact($record->extra));
    }

    /**
     * @param  array<mixed>  $data
     * @return array<mixed>
     */
    private function redact(array $data): array
    {
        foreach ($data as $key => $value) {
            if (is_string($key) && preg_match(self::PATTERN, $key) === 1) {
                $data[$key] = '[redacted]';
            } elseif (is_array($value)) {
                $data[$key] = $this->redact($value);
            }
        }

        return $data;
    }
}
