<?php

declare(strict_types=1);

namespace App\Ai\Designer;

use App\Models\AiSection;
use App\Models\AiSectionVersion;
use Illuminate\Support\Collection;

/**
 * Loads AI sections and their active / stamped versions for a store design or landing page content.
 */
final class AiSectionDefinitions
{
    /**
     * Load the tenant's AI sections referenced by a list of section placements in a single query.
     *
     * @param  array<int, mixed>  $sections
     * @return Collection<int, AiSection>
     */
    public static function loadSections(array $sections): Collection
    {
        $ids = [];
        foreach ($sections as $section) {
            if (! is_array($section) || ($section['type'] ?? null) !== 'ai') {
                continue;
            }
            $id = $section['props']['ai_section_id'] ?? null;
            if (is_int($id) || (is_string($id) && ctype_digit($id))) {
                $ids[] = (int) $id;
            }
        }

        if ($ids === []) {
            return collect();
        }

        return AiSection::query()
            ->with('current')
            ->whereIn('id', array_values(array_unique($ids)))
            ->get()
            ->keyBy('id');
    }

    /**
     * Stamp `props.version_id` from each AI section's `current_version_id` before publishing.
     *
     * @param  list<array<string, mixed>>  $sections
     * @return list<array<string, mixed>>
     */
    public static function stamp(array $sections): array
    {
        $loaded = self::loadSections($sections);
        if ($loaded->isEmpty()) {
            return $sections;
        }

        foreach ($sections as $i => $section) {
            if (($section['type'] ?? null) !== 'ai') {
                continue;
            }
            $aiSectionId = (int) ($section['props']['ai_section_id'] ?? 0);
            $aiSection = $loaded->get($aiSectionId);
            if ($aiSection !== null && $aiSection->current_version_id !== null) {
                $sections[$i]['props']['version_id'] = (int) $aiSection->current_version_id;
            }
        }

        return $sections;
    }

    /**
     * Resolve the definitions map (keyed by version id), current version map (keyed by ai_section_id),
     * and the effective version model per placement id.
     *
     * @param  array<string, mixed>  $content  A design/page content array containing `sections`.
     * @return array{
     *     definitions: array<string, array<string, mixed>>,
     *     current: array<string, int>,
     *     byPlacement: array<string, AiSectionVersion>
     * }
     */
    public static function resolve(array $content): array
    {
        $sections = is_array($content['sections'] ?? null) ? $content['sections'] : [];
        $aiSections = self::loadSections($sections);

        $stampedIds = [];
        foreach ($sections as $section) {
            if (! is_array($section) || ($section['type'] ?? null) !== 'ai') {
                continue;
            }
            $vId = $section['props']['version_id'] ?? null;
            if (is_int($vId) || (is_string($vId) && ctype_digit($vId))) {
                $stampedIds[] = (int) $vId;
            }
        }

        $stampedVersions = $stampedIds === []
            ? collect()
            : AiSectionVersion::query()->whereIn('id', array_values(array_unique($stampedIds)))->get()->keyBy('id');

        $definitions = [];
        $current = [];
        $byPlacement = [];

        foreach ($sections as $section) {
            if (! is_array($section) || ($section['type'] ?? null) !== 'ai') {
                continue;
            }

            $placementId = (string) ($section['id'] ?? '');
            $props = is_array($section['props'] ?? null) ? $section['props'] : [];
            $aiSectionId = (int) ($props['ai_section_id'] ?? 0);
            $aiSection = $aiSections->get($aiSectionId);

            if ($aiSection !== null && $aiSection->current !== null) {
                $current[(string) $aiSectionId] = (int) $aiSection->current->id;
            }

            $version = null;
            if (isset($props['version_id'])) {
                $candidate = $stampedVersions->get((int) $props['version_id']);
                if ($candidate instanceof AiSectionVersion && (int) $candidate->ai_section_id === $aiSectionId) {
                    $version = $candidate;
                }
            }
            if ($version === null && $aiSection !== null) {
                $version = $aiSection->current;
            }

            if ($version instanceof AiSectionVersion) {
                $definitions[(string) $version->id] = $version->definition();
                if ($placementId !== '') {
                    $byPlacement[$placementId] = $version;
                }
            }
        }

        return [
            'definitions' => $definitions,
            'current' => $current,
            'byPlacement' => $byPlacement,
        ];
    }

    /**
     * Return the version definitions map (keyed by version id) for a design/page content array.
     *
     * @param  array<string, mixed>  $content
     * @return array<string, array<string, mixed>>
     */
    public static function for(array $content): array
    {
        return self::resolve($content)['definitions'];
    }
}
