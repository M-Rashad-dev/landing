<?php

declare(strict_types=1);

namespace App\Ai\Images;

final class FakeStockPhotos implements StockPhotos
{
    /** @var list<array{query: string, count: int, orientation: string}> */
    public array $searches = [];

    public function __construct(private ?bool $configured = null) {}

    public function setConfigured(?bool $configured = true): self
    {
        $this->configured = $configured;

        return $this;
    }

    public function configured(): bool
    {
        if ($this->configured !== null) {
            return $this->configured;
        }

        return trim((string) (config('services.pexels.key') ?? '')) !== '';
    }

    public function search(string $query, int $count = 1, string $orientation = 'landscape'): array
    {
        $this->searches[] = [
            'query' => $query,
            'count' => $count,
            'orientation' => $orientation,
        ];

        $count = max(1, min(6, $count));
        $results = [];

        for ($i = 0; $i < $count; $i++) {
            $seed = hexdec(substr(hash('sha256', "{$query}:{$i}"), 0, 6));
            $results[] = new StockPhoto(
                bytes: self::png($seed),
                mime: 'image/png',
                photographer: 'Karim Hassan',
                url: 'https://www.pexels.com/photo/sample-'.($i + 1).'/',
            );
        }

        return $results;
    }

    private static function png(int $rgb): string
    {
        $image = imagecreatetruecolor(512, 512);
        imagefill($image, 0, 0, (int) imagecolorallocate($image, 128 + (($rgb >> 16) & 127), 128 + (($rgb >> 8) & 127), 128 + ($rgb & 127)));
        ob_start();
        imagepng($image);

        return (string) ob_get_clean();
    }
}
