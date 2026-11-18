<?php

declare(strict_types=1);

namespace App\Ai\Images;

use App\Ai\AiImage;

final readonly class StockPhoto
{
    public function __construct(
        public string $bytes,
        public string $mime,
        public string $photographer,
        public string $url = '',
    ) {}

    public function toAiImage(): AiImage
    {
        return new AiImage($this->bytes, $this->mime, 'pexels', 0.0);
    }

    public function credit(): string
    {
        $name = trim($this->photographer);

        return $name !== '' ? "Photo: {$name} / Pexels" : 'Photo: Pexels';
    }
}
