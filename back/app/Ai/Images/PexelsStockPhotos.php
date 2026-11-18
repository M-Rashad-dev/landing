<?php

declare(strict_types=1);

namespace App\Ai\Images;

use Illuminate\Support\Facades\Http;
use Throwable;

final class PexelsStockPhotos implements StockPhotos
{
    public function configured(): bool
    {
        return $this->apiKey() !== '';
    }

    public function search(string $query, int $count = 1, string $orientation = 'landscape'): array
    {
        $apiKey = $this->apiKey();
        $query = trim($query);

        if ($apiKey === '' || $query === '') {
            return [];
        }

        $count = max(1, min(6, $count));
        $orientation = in_array($orientation, ['landscape', 'portrait', 'square'], true)
            ? $orientation
            : 'landscape';

        try {
            $response = Http::withHeaders([
                'Authorization' => $apiKey,
                'Accept' => 'application/json',
            ])
                ->timeout(20)
                ->get('https://api.pexels.com/v1/search', [
                    'query' => $query,
                    'per_page' => $count,
                    'orientation' => $orientation,
                ]);

            if (! $response->successful()) {
                return [];
            }

            $photos = $response->json('photos');
            if (! is_array($photos)) {
                return [];
            }

            $results = [];
            foreach (array_slice($photos, 0, $count) as $photo) {
                if (! is_array($photo)) {
                    continue;
                }

                $src = is_array($photo['src'] ?? null) ? $photo['src'] : [];
                $imageUrl = (string) ($src['large2x'] ?? $src['large'] ?? $src['original'] ?? '');
                if ($imageUrl === '') {
                    continue;
                }

                $imgResponse = Http::timeout(25)->get($imageUrl);
                if (! $imgResponse->successful()) {
                    continue;
                }

                $bytes = $imgResponse->body();
                if ($bytes === '') {
                    continue;
                }

                $contentType = strtolower((string) $imgResponse->header('Content-Type'));
                $mime = match (true) {
                    str_contains($contentType, 'png') => 'image/png',
                    str_contains($contentType, 'webp') => 'image/webp',
                    default => 'image/jpeg',
                };

                $photographer = trim((string) ($photo['photographer'] ?? 'Pexels'));
                $pageUrl = trim((string) ($photo['url'] ?? ''));

                $results[] = new StockPhoto($bytes, $mime, $photographer, $pageUrl);
            }

            return $results;
        } catch (Throwable $e) {
            report($e);

            return [];
        }
    }

    private function apiKey(): string
    {
        return trim((string) (config('services.pexels.key') ?? ''));
    }
}
