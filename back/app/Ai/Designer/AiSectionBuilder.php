<?php

declare(strict_types=1);

namespace App\Ai\Designer;

use App\Models\AiChat;
use App\Models\AiSectionVersion;
use Illuminate\Support\Facades\DB;

/**
 * Validates and persists a section proposed by the AI designer (docs/plans/ai-designer.md §2.4).
 */
final class AiSectionBuilder
{
    /**
     * Validate the AI's `section` payload (fields, HTML sanitizer, template tokens, CSS scoping)
     * and store a `proposed` AiSectionVersion row.
     *
     * @param  array<string, mixed>  $section
     * @return AiSectionVersion|list<string>
     */
    public function fromAi(array $section, AiChat $chat, ?int $editOf): AiSectionVersion|array
    {
        $errors = [];

        $rawName = is_string($section['name'] ?? null) ? trim(strip_tags($section['name'])) : '';
        $name = $rawName !== '' ? mb_substr($rawName, 0, 100, 'UTF-8') : 'قسم مخصص';

        $rawFields = is_array($section['fields'] ?? null) ? $section['fields'] : [];
        $schema = AiSectionFields::schema($rawFields, $chat->kind);
        array_push($errors, ...$schema['errors']);

        $rawHtml = is_string($section['html'] ?? null) ? $section['html'] : '';
        $sanitized = AiSectionSanitizer::clean($rawHtml);
        array_push($errors, ...$sanitized['errors']);

        if ($sanitized['errors'] === []) {
            $templateErrors = AiTemplate::validate($sanitized['html'], $schema['fields'], $chat->kind);
            array_push($errors, ...$templateErrors);
        }

        $rawCss = is_string($section['css'] ?? null) ? $section['css'] : '';
        $preCss = AiSectionCss::scope($rawCss, '0');
        array_push($errors, ...$preCss['errors']);

        if ($errors !== []) {
            return array_values(array_unique($errors));
        }

        /** @var AiSectionVersion|list<string> $result */
        $result = DB::transaction(function () use ($chat, $editOf, $name, $sanitized, $rawCss, $schema): AiSectionVersion|array {
            $version = AiSectionVersion::query()->create([
                'chat_id' => $chat->id,
                'ai_section_id' => $editOf,
                'name' => $name,
                'html' => $sanitized['html'],
                'css_raw' => $rawCss,
                'css' => '',
                'fields' => $schema['fields'],
                'status' => 'proposed',
            ]);

            $scoped = AiSectionCss::scope($rawCss, (string) $version->id);
            if ($scoped['errors'] !== []) {
                DB::rollBack();

                return $scoped['errors'];
            }

            $version->forceFill(['css' => $scoped['css']])->save();

            return $version;
        });

        return $result;
    }
}
