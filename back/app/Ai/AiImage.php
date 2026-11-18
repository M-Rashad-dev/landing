<?php

declare(strict_types=1);

namespace App\Ai;

/**
 * An image the AI made or edited: its bytes and type, the model asked, and what the provider says
 * it cost in USD (OpenRouter reports it; null when unknown, then config ai.image_prices is used).
 */
final class AiImage
{
    public function __construct(
        public readonly string $bytes,
        public readonly string $mime,
        public readonly string $model,
        public readonly ?float $costUsd = null,
    ) {}

    /** The file extension of its type (webp, png, jpg). */
    public function extension(): string
    {
        return match ($this->mime) {
            'image/png' => 'png',
            'image/jpeg', 'image/jpg' => 'jpg',
            'image/gif' => 'gif',
            default => 'webp',
        };
    }
}
