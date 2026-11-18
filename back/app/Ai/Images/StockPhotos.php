<?php

declare(strict_types=1);

namespace App\Ai\Images;

interface StockPhotos
{
    public function configured(): bool;

    /**
     * @return list<StockPhoto>
     */
    public function search(string $query, int $count = 1, string $orientation = 'landscape'): array;
}
