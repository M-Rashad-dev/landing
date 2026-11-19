<?php

declare(strict_types=1);

namespace App\Ai\Designer;

/**
 * Tokenizer and validator for the AI section template language (docs/plans/ai-designer.md §3.3).
 * Pure logic, no database access.
 */
final class AiTemplate
{
    private const TEXT_FIELD_TYPES = ['text', 'textarea', 'number'];

    private const EACH_FIELD_TYPES = ['products', 'categories', 'images', 'list'];

    private const PRODUCT_TEXT_KEYS = ['name', 'price', 'old_price', 'discount', 'rating'];

    private const PRODUCT_IF_KEYS = ['name', 'price', 'old_price', 'discount', 'rating', 'image', 'url'];

    private const CATEGORY_TEXT_KEYS = ['name', 'count'];

    private const CATEGORY_IF_KEYS = ['name', 'count', 'image', 'url'];

    /**
     * Split an HTML template into literal text segments and `{{ ... }}` tokens.
     *
     * @return list<array{type: 'text'|'token', value: string, offset: int}>
     */
    public static function tokenize(string $html): array
    {
        $parts = [];
        $pattern = '/\{\{(.*?)\}\}/s';
        $cursor = 0;
        $length = strlen($html);

        if (preg_match_all($pattern, $html, $matches, PREG_OFFSET_CAPTURE)) {
            foreach ($matches[0] as $idx => $fullMatch) {
                $matchStr = $fullMatch[0];
                $matchOffset = (int) $fullMatch[1];

                if ($matchOffset > $cursor) {
                    $parts[] = [
                        'type' => 'text',
                        'value' => substr($html, $cursor, $matchOffset - $cursor),
                        'offset' => $cursor,
                    ];
                }

                $inner = (string) preg_replace('/\s+/', ' ', trim($matches[1][$idx][0]));
                $parts[] = [
                    'type' => 'token',
                    'value' => $inner,
                    'offset' => $matchOffset,
                ];

                $cursor = $matchOffset + strlen($matchStr);
            }
        }

        if ($cursor < $length) {
            $parts[] = [
                'type' => 'text',
                'value' => substr($html, $cursor),
                'offset' => $cursor,
            ];
        }

        return $parts;
    }

    /**
     * Validate all template tokens against the declared fields and the target kind (store|landing).
     *
     * @param  list<array<string, mixed>>  $fields
     * @return list<string> English errors for the AI repair turn (empty when valid).
     */
    public static function validate(string $html, array $fields, string $kind): array
    {
        $errors = [];

        $topFields = [];
        foreach ($fields as $field) {
            if (! is_array($field) || ! isset($field['key'], $field['type']) || ! is_string($field['key']) || ! is_string($field['type'])) {
                continue;
            }
            $key = $field['key'];
            $type = $field['type'];
            $topFields[$key] = $field;

            if ($kind === 'landing' && in_array($type, ['products', 'categories'], true)) {
                $errors[] = "Field '{$key}' of type '{$type}' is not allowed on landing pages.";
            }
        }

        $stripped = (string) preg_replace('/\{\{.*?\}\}/s', '', $html);
        if (str_contains($stripped, '{{') || str_contains($stripped, '}}')) {
            $errors[] = 'Unbalanced {{ or }} braces in template.';
        }

        $placements = self::inspectPlacements($html, $errors);
        $tokens = self::tokenize($html);

        /** @var list<array{block: 'each'|'if', key: string, field?: array<string, mixed>|null, hasElse?: bool}> $stack */
        $stack = [];

        foreach ($tokens as $part) {
            if ($part['type'] !== 'token') {
                continue;
            }

            $expr = $part['value'];
            $offset = $part['offset'];
            $place = $placements[$offset] ?? ['where' => 'text'];

            if ($expr === '') {
                $errors[] = 'Empty {{ }} token is not allowed.';

                continue;
            }

            if ($place['where'] === 'tag') {
                $errors[] = "Token '{{{$expr}}}' is not allowed inside an HTML tag outside an attribute value.";

                continue;
            }

            $currentEach = self::currentEach($stack);

            // Block tags: #each, /each, #if, else, /if
            if (str_starts_with($expr, '#each ') || $expr === '#each') {
                if ($place['where'] !== 'text') {
                    $errors[] = "Block token '{{{$expr}}}' cannot be used inside an HTML attribute.";

                    continue;
                }
                if ($currentEach !== null) {
                    $errors[] = 'Nested {{#each}} inside another {{#each}} is not allowed.';
                }
                $key = trim(substr($expr, 5));
                $field = $topFields[$key] ?? null;
                if ($key === '' || $field === null) {
                    $errors[] = "Unknown field '{$key}' in {{#each}}.";
                } elseif (! in_array($field['type'], self::EACH_FIELD_TYPES, true)) {
                    $errors[] = "Field '{$key}' of type '{$field['type']}' cannot be repeated with {{#each}}.";
                } elseif ($kind === 'landing' && in_array($field['type'], ['products', 'categories'], true)) {
                    $errors[] = "Field '{$key}' of type '{$field['type']}' is not allowed on landing pages.";
                }
                $stack[] = ['block' => 'each', 'key' => $key, 'field' => $field];

                continue;
            }

            if ($expr === '/each') {
                if ($place['where'] !== 'text') {
                    $errors[] = 'Block token \'{{/each}}\' cannot be used inside an HTML attribute.';

                    continue;
                }
                $top = end($stack);
                if ($top === false || $top['block'] !== 'each') {
                    $errors[] = 'Unbalanced {{/each}} token.';
                } else {
                    array_pop($stack);
                }

                continue;
            }

            if (str_starts_with($expr, '#if ') || $expr === '#if') {
                if ($place['where'] !== 'text') {
                    $errors[] = "Block token '{{{$expr}}}' cannot be used inside an HTML attribute.";

                    continue;
                }
                if (self::ifDepth($stack) >= 2) {
                    $errors[] = '{{#if}} nesting exceeds the maximum depth of 2.';
                }
                $key = trim(substr($expr, 3));
                self::validateIfKey($key, $topFields, $currentEach, $kind, $errors);
                $stack[] = ['block' => 'if', 'key' => $key, 'hasElse' => false];

                continue;
            }

            if ($expr === 'else') {
                if ($place['where'] !== 'text') {
                    $errors[] = 'Block token \'{{else}}\' cannot be used inside an HTML attribute.';

                    continue;
                }
                $lastIdx = count($stack) - 1;
                if ($lastIdx < 0 || $stack[$lastIdx]['block'] !== 'if' || ! empty($stack[$lastIdx]['hasElse'])) {
                    $errors[] = 'Unbalanced or duplicate {{else}} token.';
                } else {
                    $stack[$lastIdx]['hasElse'] = true;
                }

                continue;
            }

            if ($expr === '/if') {
                if ($place['where'] !== 'text') {
                    $errors[] = 'Block token \'{{/if}}\' cannot be used inside an HTML attribute.';

                    continue;
                }
                $top = end($stack);
                if ($top === false || $top['block'] !== 'if') {
                    $errors[] = 'Unbalanced {{/if}} token.';
                } else {
                    array_pop($stack);
                }

                continue;
            }

            // {{index}}
            if ($expr === 'index') {
                if ($place['where'] !== 'text') {
                    $errors[] = '{{index}} is only allowed in text.';
                }
                if ($currentEach === null) {
                    $errors[] = '{{index}} is only allowed inside {{#each}}.';
                }

                continue;
            }

            // {{order_link}}
            if ($expr === 'order_link') {
                if ($kind !== 'landing') {
                    $errors[] = '{{order_link}} is only allowed on landing pages.';
                }
                if (! self::isAttr($place, 'a', 'href')) {
                    $errors[] = '{{order_link}} is only allowed as the whole href value of <a>.';
                }

                continue;
            }

            // {{product.name}}, {{product.price}}, {{product.old_price}}
            if (in_array($expr, ['product.name', 'product.price', 'product.old_price'], true)) {
                if ($kind !== 'landing') {
                    $errors[] = "{{{$expr}}} is only allowed on landing pages.";
                }
                if ($place['where'] !== 'text') {
                    $errors[] = "{{{$expr}}} is only allowed in text.";
                }

                continue;
            }

            // {{img product.image}}
            if ($expr === 'img product.image') {
                if ($kind !== 'landing') {
                    $errors[] = '{{img product.image}} is only allowed on landing pages.';
                }
                if (! self::isAttr($place, 'img', 'src')) {
                    $errors[] = '{{img product.image}} is only allowed as the whole src value of <img>.';
                }

                continue;
            }

            // {{img}} bare inside {{#each images}}
            if ($expr === 'img') {
                if (! self::isAttr($place, 'img', 'src')) {
                    $errors[] = '{{img}} is only allowed as the whole src value of <img>.';
                }
                if (($currentEach['type'] ?? null) !== 'images') {
                    $errors[] = '{{img}} is only allowed inside {{#each}} of an images field.';
                }

                continue;
            }

            // {{img key}}
            if (str_starts_with($expr, 'img ')) {
                $key = trim(substr($expr, 4));
                if (! self::isAttr($place, 'img', 'src')) {
                    $errors[] = "{{img {$key}}} is only allowed as the whole src value of <img>.";
                }
                self::validateImgKey($key, $topFields, $currentEach, $errors);

                continue;
            }

            // {{link key}}
            if (str_starts_with($expr, 'link ')) {
                $key = trim(substr($expr, 5));
                if (! self::isAttr($place, 'a', 'href')) {
                    $errors[] = "{{link {$key}}} is only allowed as the whole href value of <a>.";
                }
                self::validateLinkKey($key, $topFields, $currentEach, $errors);

                continue;
            }

            // {{date key}}
            if (str_starts_with($expr, 'date ')) {
                $key = trim(substr($expr, 5));
                if (! self::isAttr($place, null, 'data-ai-ends')) {
                    $errors[] = "{{date {$key}}} is only allowed as the whole value of data-ai-ends.";
                }
                $field = $topFields[$key] ?? null;
                if ($field === null) {
                    $errors[] = "Unknown date field '{$key}'.";
                } elseif ($field['type'] !== 'date') {
                    $errors[] = "Field '{$key}' of type '{$field['type']}' cannot be used in {{date {$key}}}.";
                }

                continue;
            }

            // {{id}}
            if ($expr === 'id') {
                if ($kind !== 'store') {
                    $errors[] = '{{id}} is only allowed on store sections.';
                }
                if (($currentEach['type'] ?? null) !== 'products') {
                    $errors[] = '{{id}} is only allowed inside {{#each}} of a products field.';
                }
                if (! self::isAttr($place, 'button', 'data-ai-add')) {
                    $errors[] = '{{id}} is only allowed as the whole data-ai-add value of <button>.';
                }

                continue;
            }

            // {{copy key}}
            if (str_starts_with($expr, 'copy ')) {
                $key = trim(substr($expr, 5));
                if (! self::isAttr($place, 'button', 'data-ai-copy')) {
                    $errors[] = "{{copy {$key}}} is only allowed as the whole data-ai-copy value of <button>.";
                }
                self::validateTextKey($key, $topFields, $currentEach, $errors);

                continue;
            }

            // {{video key}} / {{audio key}}
            if (str_starts_with($expr, 'video ') || str_starts_with($expr, 'audio ')) {
                $kindName = str_starts_with($expr, 'video ') ? 'video' : 'audio';
                $key = trim(substr($expr, 6));
                $attrName = "data-ai-{$kindName}";
                if (! self::isAttr($place, null, $attrName)) {
                    $errors[] = "{{{$kindName} {$key}}} is only allowed as the whole {$attrName} value of a container element.";
                }
                self::validateSimpleTypedKey($key, $kindName, $topFields, $currentEach, $errors);

                continue;
            }

            // Plain {{key}}
            if ($place['where'] !== 'text') {
                $errors[] = "Token '{{{$expr}}}' is only allowed in text, not inside an HTML attribute.";

                continue;
            }

            self::validateTextKey($expr, $topFields, $currentEach, $errors);
        }

        foreach ($stack as $unclosed) {
            $errors[] = "Unclosed {{#{$unclosed['block']} {$unclosed['key']}}} block.";
        }

        return array_values(array_unique($errors));
    }

    /**
     * Map token byte offsets inside HTML tags / attributes and record partial-attribute placement errors.
     *
     * @param  list<string>  $errors
     * @return array<int, array{where: 'text'|'attr'|'tag', tag?: string, attr?: string, whole?: bool}>
     */
    private static function inspectPlacements(string $html, array &$errors): array
    {
        $placements = [];
        $tagPattern = '/<([a-zA-Z][a-zA-Z0-9:-]*)\b((?:[^>"\']|"[^"]*"|\'[^\']*\')*)>/s';

        if (! preg_match_all($tagPattern, $html, $tagMatches, PREG_OFFSET_CAPTURE)) {
            return $placements;
        }

        foreach ($tagMatches[0] as $i => $fullTag) {
            $tagName = strtolower($tagMatches[1][$i][0]);
            $attrChunk = $tagMatches[2][$i][0];
            $attrChunkOffset = (int) $tagMatches[2][$i][1];
            $tagStart = (int) $fullTag[1];
            $tagEnd = $tagStart + strlen($fullTag[0]);

            $coveredOffsets = [];

            // Find attributes inside the tag
            $attrPattern = '/([a-zA-Z0-9_:-]+)\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>"\']+))/s';
            if (preg_match_all($attrPattern, $attrChunk, $attrMatches, PREG_OFFSET_CAPTURE)) {
                foreach ($attrMatches[0] as $j => $fullAttr) {
                    $attrName = strtolower($attrMatches[1][$j][0]);

                    $val = '';
                    $valOffset = 0;
                    foreach ([2, 3, 4] as $group) {
                        if (isset($attrMatches[$group][$j]) && $attrMatches[$group][$j][1] !== -1) {
                            $val = $attrMatches[$group][$j][0];
                            $valOffset = $attrChunkOffset + (int) $attrMatches[$group][$j][1];
                            break;
                        }
                    }

                    if (! str_contains($val, '{{')) {
                        continue;
                    }

                    $isWhole = (bool) preg_match('/^\s*\{\{[^{}]+\}\}\s*$/s', $val);
                    if (! $isWhole) {
                        $errors[] = "Token inside attribute '{$attrName}' on <{$tagName}> must be the entire attribute value.";
                    }

                    if (preg_match_all('/\{\{.*?\}\}/s', $val, $tokMatches, PREG_OFFSET_CAPTURE)) {
                        foreach ($tokMatches[0] as $tok) {
                            $tokOffset = $valOffset + (int) $tok[1];
                            $coveredOffsets[$tokOffset] = true;
                            $placements[$tokOffset] = [
                                'where' => 'attr',
                                'tag' => $tagName,
                                'attr' => $attrName,
                                'whole' => $isWhole,
                            ];
                        }
                    }
                }
            }

            // Any token inside the tag that was not inside an attribute value
            if (preg_match_all('/\{\{.*?\}\}/s', $fullTag[0], $rawToks, PREG_OFFSET_CAPTURE)) {
                foreach ($rawToks[0] as $tok) {
                    $tokOffset = $tagStart + (int) $tok[1];
                    if ($tokOffset >= $tagStart && $tokOffset < $tagEnd && ! isset($coveredOffsets[$tokOffset])) {
                        $placements[$tokOffset] = ['where' => 'tag', 'tag' => $tagName];
                    }
                }
            }
        }

        return $placements;
    }

    /**
     * @param  array{where: string, tag?: string, attr?: string, whole?: bool}  $place
     */
    private static function isAttr(array $place, ?string $expectedTag, string $expectedAttr): bool
    {
        if ($place['where'] !== 'attr' || empty($place['whole'])) {
            return false;
        }
        if (($place['attr'] ?? '') !== $expectedAttr) {
            return false;
        }

        return $expectedTag === null || ($place['tag'] ?? '') === $expectedTag;
    }

    /**
     * @param  list<array{block: 'each'|'if', key: string, field?: array<string, mixed>|null, hasElse?: bool}>  $stack
     * @return array<string, mixed>|null
     */
    private static function currentEach(array $stack): ?array
    {
        for ($i = count($stack) - 1; $i >= 0; $i--) {
            if ($stack[$i]['block'] === 'each') {
                return $stack[$i]['field'] ?? ['key' => $stack[$i]['key'], 'type' => 'unknown'];
            }
        }

        return null;
    }

    /**
     * @param  list<array{block: 'each'|'if', key: string, field?: array<string, mixed>|null, hasElse?: bool}>  $stack
     */
    private static function ifDepth(array $stack): int
    {
        $depth = 0;
        foreach ($stack as $item) {
            if ($item['block'] === 'if') {
                $depth++;
            }
        }

        return $depth;
    }

    /**
     * @param  array<string, array<string, mixed>>  $topFields
     * @param  array<string, mixed>|null  $currentEach
     * @param  list<string>  $errors
     */
    private static function validateIfKey(
        string $key,
        array $topFields,
        ?array $currentEach,
        string $kind,
        array &$errors,
    ): void {
        if ($key === '') {
            $errors[] = 'Empty key in {{#if}}.';

            return;
        }

        if (str_starts_with($key, 'product.')) {
            if ($kind !== 'landing') {
                $errors[] = "Token '{{#if {$key}}}' is only allowed on landing pages.";
            } elseif (! in_array($key, ['product.name', 'product.price', 'product.old_price', 'product.image'], true)) {
                $errors[] = "Unknown landing product key '{$key}' in {{#if}}.";
            }

            return;
        }

        if ($currentEach !== null) {
            $eachType = $currentEach['type'] ?? '';
            if ($eachType === 'products' && in_array($key, self::PRODUCT_IF_KEYS, true)) {
                return;
            }
            if ($eachType === 'categories' && in_array($key, self::CATEGORY_IF_KEYS, true)) {
                return;
            }
            if ($eachType === 'images' && in_array($key, ['img', 'alt'], true)) {
                return;
            }
            if ($eachType === 'list' && self::findSubField($currentEach, $key) !== null) {
                return;
            }
        }

        if (isset($topFields[$key])) {
            return;
        }

        $errors[] = "Unknown field '{$key}' in {{#if}}.";
    }

    /**
     * @param  array<string, array<string, mixed>>  $topFields
     * @param  array<string, mixed>|null  $currentEach
     * @param  list<string>  $errors
     */
    private static function validateImgKey(
        string $key,
        array $topFields,
        ?array $currentEach,
        array &$errors,
    ): void {
        if ($currentEach !== null) {
            $eachType = $currentEach['type'] ?? '';
            if (in_array($eachType, ['products', 'categories'], true) && $key === 'image') {
                return;
            }
            if ($eachType === 'list') {
                $sub = self::findSubField($currentEach, $key);
                if ($sub !== null) {
                    if ($sub['type'] !== 'image') {
                        $errors[] = "Sub-field '{$key}' of type '{$sub['type']}' is not an image field.";
                    }

                    return;
                }
            }
        }

        $field = $topFields[$key] ?? null;
        if ($field === null) {
            $errors[] = "Unknown image field '{$key}'.";
        } elseif ($field['type'] !== 'image') {
            $errors[] = "Field '{$key}' of type '{$field['type']}' cannot be used in {{img {$key}}}.";
        }
    }

    /**
     * @param  array<string, array<string, mixed>>  $topFields
     * @param  array<string, mixed>|null  $currentEach
     * @param  list<string>  $errors
     */
    private static function validateLinkKey(
        string $key,
        array $topFields,
        ?array $currentEach,
        array &$errors,
    ): void {
        if ($currentEach !== null) {
            $eachType = $currentEach['type'] ?? '';
            if (in_array($eachType, ['products', 'categories'], true) && $key === 'url') {
                return;
            }
            if ($eachType === 'list') {
                $sub = self::findSubField($currentEach, $key);
                if ($sub !== null) {
                    if ($sub['type'] !== 'link') {
                        $errors[] = "Sub-field '{$key}' of type '{$sub['type']}' is not a link field.";
                    }

                    return;
                }
            }
        }

        $field = $topFields[$key] ?? null;
        if ($field === null) {
            $errors[] = "Unknown link field '{$key}'.";
        } elseif ($field['type'] !== 'link') {
            $errors[] = "Field '{$key}' of type '{$field['type']}' cannot be used in {{link {$key}}}.";
        }
    }

    /**
     * @param  array<string, array<string, mixed>>  $topFields
     * @param  array<string, mixed>|null  $currentEach
     * @param  list<string>  $errors
     */
    private static function validateTextKey(
        string $key,
        array $topFields,
        ?array $currentEach,
        array &$errors,
    ): void {
        if (! preg_match('/^[a-z][a-z0-9_]*$/', $key)) {
            $errors[] = "Invalid token '{{{$key}}}'.";

            return;
        }

        if ($currentEach !== null) {
            $eachType = $currentEach['type'] ?? '';
            if ($eachType === 'products') {
                if (in_array($key, self::PRODUCT_TEXT_KEYS, true)) {
                    return;
                }
                if (in_array($key, ['image', 'url'], true)) {
                    $errors[] = "Product item field '{$key}' cannot be rendered as plain text.";

                    return;
                }
            } elseif ($eachType === 'categories') {
                if (in_array($key, self::CATEGORY_TEXT_KEYS, true)) {
                    return;
                }
                if (in_array($key, ['image', 'url'], true)) {
                    $errors[] = "Category item field '{$key}' cannot be rendered as plain text.";

                    return;
                }
            } elseif ($eachType === 'images') {
                if ($key === 'alt') {
                    return;
                }
            } elseif ($eachType === 'list') {
                $sub = self::findSubField($currentEach, $key);
                if ($sub !== null) {
                    if (! in_array($sub['type'], self::TEXT_FIELD_TYPES, true)) {
                        $errors[] = "Sub-field '{$key}' of type '{$sub['type']}' cannot be rendered as plain text.";
                    }

                    return;
                }
            }
        }

        $field = $topFields[$key] ?? null;
        if ($field === null) {
            $errors[] = "Unknown field '{$key}'.";
        } elseif (! in_array($field['type'], self::TEXT_FIELD_TYPES, true)) {
            $errors[] = "Field '{$key}' of type '{$field['type']}' cannot be rendered as plain text.";
        }
    }

    /**
     * @param  array<string, array<string, mixed>>  $topFields
     * @param  array<string, mixed>|null  $currentEach
     * @param  list<string>  $errors
     */
    private static function validateSimpleTypedKey(
        string $key,
        string $expectedType,
        array $topFields,
        ?array $currentEach,
        array &$errors,
    ): void {
        if ($currentEach !== null && ($currentEach['type'] ?? '') === 'list') {
            $sub = self::findSubField($currentEach, $key);
            if ($sub !== null) {
                if ($sub['type'] !== $expectedType) {
                    $errors[] = "Sub-field '{$key}' of type '{$sub['type']}' is not a {$expectedType} field.";
                }

                return;
            }
        }

        $field = $topFields[$key] ?? null;
        if ($field === null) {
            $errors[] = "Unknown {$expectedType} field '{$key}'.";
        } elseif ($field['type'] !== $expectedType) {
            $errors[] = "Field '{$key}' of type '{$field['type']}' cannot be used in {{{$expectedType} {$key}}}.";
        }
    }

    /**
     * @param  array<string, mixed>  $listField
     * @return array<string, mixed>|null
     */
    private static function findSubField(array $listField, string $key): ?array
    {
        $subs = $listField['fields'] ?? null;
        if (! is_array($subs)) {
            return null;
        }
        foreach ($subs as $sub) {
            if (is_array($sub) && ($sub['key'] ?? null) === $key && is_string($sub['type'] ?? null)) {
                return $sub;
            }
        }

        return null;
    }
}
