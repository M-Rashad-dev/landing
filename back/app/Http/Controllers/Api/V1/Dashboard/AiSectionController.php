<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\AiSectionIndexRequest;
use App\Models\AiSection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

/**
 * «أقسامي»: lists and archives a store's saved AI sections for a specific kind and theme.
 */
final class AiSectionController extends Controller
{
    public function index(AiSectionIndexRequest $request): JsonResponse
    {
        $kind = (string) $request->validated('kind');
        $themeKey = (string) $request->validated('theme_key');

        $sections = AiSection::query()
            ->with('current')
            ->forTheme($kind, $themeKey)
            ->whereNull('archived_at')
            ->whereNotNull('current_version_id')
            ->orderByDesc('id')
            ->get()
            ->filter(fn (AiSection $section): bool => $section->current !== null)
            ->map(fn (AiSection $section): array => [
                'id' => $section->id,
                'name' => $section->name,
                'updated_at' => $section->updated_at?->toIso8601ZuluString(),
                'current' => $section->current->definition(),
            ])
            ->values()
            ->all();

        return $this->ok($sections);
    }

    public function destroy(AiSection $aiSection): Response
    {
        if ($aiSection->archived_at === null) {
            $aiSection->forceFill(['archived_at' => now()])->save();
        }

        return $this->noContent();
    }
}
