<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Support;

/**
 * What a copilot tool gives back to the model: data, or an error it can fix (a wrong argument, a
 * validation message, a plan limit). Encoded as JSON and cut to a safe size.
 */
final class ToolResult
{
    /** The most a tool result may weigh in the conversation (bytes). */
    public const MAX_BYTES = 12_000;

    /**
     * @param  array<string, mixed>  $data
     */
    private function __construct(public readonly array $data, public readonly bool $failed) {}

    /** @param array<string, mixed> $data */
    public static function ok(array $data): self
    {
        return new self($data, false);
    }

    /** @param array<string, mixed> $fields per-field messages */
    public static function error(string $message, array $fields = []): self
    {
        return new self(array_filter(['error' => $message, 'fields' => $fields ?: null], fn ($v) => $v !== null), true);
    }

    /** The JSON for the model: whole when small, else cut with "truncated": true. */
    public function toJson(): string
    {
        $json = (string) json_encode($this->data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        if (strlen($json) <= self::MAX_BYTES) {
            return $json;
        }

        // Keep the head of the data (lists cut from the end) so it stays valid JSON.
        $data = $this->data;
        while (strlen($json) > self::MAX_BYTES && self::shrink($data)) {
            $json = (string) json_encode($data + ['truncated' => true], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        }

        return strlen($json) <= self::MAX_BYTES ? $json : (string) json_encode(['truncated' => true, 'text' => mb_strcut($json, 0, self::MAX_BYTES - 64)], JSON_UNESCAPED_UNICODE);
    }

    /**
     * Drops the last element of the biggest list (or cuts the longest string). False when nothing is left to cut.
     *
     * @param  array<string, mixed>  $data
     */
    private static function shrink(array &$data): bool
    {
        $biggest = null;
        $size = 0;
        foreach ($data as $key => $value) {
            $len = strlen((string) json_encode($value, JSON_UNESCAPED_UNICODE));
            if ((is_array($value) && $value !== []) || (is_string($value) && mb_strlen($value) > 200)) {
                if ($len > $size) {
                    $biggest = $key;
                    $size = $len;
                }
            }
        }
        if ($biggest === null) {
            return false;
        }
        if (is_array($data[$biggest])) {
            array_pop($data[$biggest]);
        } else {
            $data[$biggest] = mb_substr((string) $data[$biggest], 0, (int) (mb_strlen((string) $data[$biggest]) * 0.7)).'…';
        }

        return true;
    }
}
