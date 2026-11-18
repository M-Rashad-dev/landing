<?php

declare(strict_types=1);

namespace App\Ai\Designer;

use Sabberworm\CSS\CSSList\AtRuleBlockList;
use Sabberworm\CSS\CSSList\CSSList;
use Sabberworm\CSS\CSSList\KeyFrame;
use Sabberworm\CSS\OutputFormat;
use Sabberworm\CSS\Parser;
use Sabberworm\CSS\Property\Declaration;
use Sabberworm\CSS\Property\KeyframeSelector;
use Sabberworm\CSS\Property\Selector;
use Sabberworm\CSS\RuleSet\DeclarationBlock;
use Sabberworm\CSS\Settings;
use Sabberworm\CSS\Value\Value;
use Throwable;

/**
 * Parses, sanitizes, and scopes AI section CSS to `[data-ai-v="{versionKey}"]`
 * using sabberworm/php-css-parser (docs/plans/ai-designer.md §3.4).
 */
final class AiSectionCss
{
    public const MAX_BYTES = 40000;

    public const MAX_RULES = 800;

    private const ALLOWED_AT_BLOCKS = ['media', 'container', 'supports'];

    private const ALLOWED_FONTS = [
        'var(--ai-font-body)',
        'var(--ai-font-display)',
        'inherit',
    ];

    /**
     * Sanitize and scope raw CSS for a specific section version key.
     *
     * @return array{css: string, errors: list<string>}
     */
    public static function scope(string $css, string $versionKey): array
    {
        $errors = [];

        if (strlen($css) > self::MAX_BYTES) {
            return ['css' => '', 'errors' => ['CSS exceeds the 40,000 byte limit.']];
        }

        if (trim($css) === '') {
            return ['css' => '', 'errors' => []];
        }

        $safeKey = (string) preg_replace('/[^a-zA-Z0-9_-]/', '', $versionKey);
        $scopeAttr = '[data-ai-v="'.$safeKey.'"]';

        // Strip comments and replace backslashes with a sentinel before parsing so CSS unicode escapes cannot bypass filters
        $cleanInput = (string) preg_replace('/\/\*.*?\*\//s', '', $css);
        $cleanInput = str_replace('\\', '__AI_BSLASH__', $cleanInput);

        try {
            $settings = Settings::create()->withLenientParsing(true);
            $parser = new Parser($cleanInput, $settings);
            $document = $parser->parse();
        } catch (Throwable) {
            return ['css' => '', 'errors' => ['CSS could not be parsed.']];
        }

        $ruleCount = self::countRules($document);
        if ($ruleCount > self::MAX_RULES) {
            return ['css' => '', 'errors' => ['CSS exceeds the 800 rule limit.']];
        }

        $format = OutputFormat::createCompact();

        // Pass 1: collect and rename @keyframes
        $keyframesMap = [];
        self::collectKeyframes($document, $safeKey, $keyframesMap);

        // Pass 2: filter and transform the CSS tree
        self::processList($document, $scopeAttr, $keyframesMap, $format, false);

        try {
            $rendered = trim($document->render($format));
        } catch (Throwable) {
            return ['css' => '', 'errors' => ['CSS could not be rendered after scoping.']];
        }

        return [
            'css' => $rendered,
            'errors' => $errors,
        ];
    }

    private static function countRules(CSSList $list): int
    {
        $count = 0;
        foreach ($list->getContents() as $item) {
            if ($item instanceof DeclarationBlock) {
                $count++;
            } elseif ($item instanceof CSSList) {
                $count += 1 + self::countRules($item);
            } else {
                $count++;
            }
        }

        return $count;
    }

    /**
     * @param  array<string, string>  $keyframesMap
     */
    private static function collectKeyframes(CSSList $list, string $safeKey, array &$keyframesMap): void
    {
        foreach ($list->getContents() as $item) {
            if ($item instanceof KeyFrame) {
                $rawName = trim($item->getAnimationName(), " \t\n\r\0\x0B\"'");
                if ($rawName !== '' && preg_match('/^[a-zA-Z0-9_-]+$/', $rawName)) {
                    $newName = "ai{$safeKey}-{$rawName}";
                    $keyframesMap[$rawName] = $newName;
                    $item->setAnimationName($newName);
                }
            } elseif ($item instanceof AtRuleBlockList) {
                self::collectKeyframes($item, $safeKey, $keyframesMap);
            }
        }
    }

    /**
     * @param  array<string, string>  $keyframesMap
     */
    private static function processList(
        CSSList $list,
        string $scopeAttr,
        array $keyframesMap,
        OutputFormat $format,
        bool $inKeyframes,
    ): void {
        $kept = [];

        foreach ($list->getContents() as $item) {
            if ($item instanceof DeclarationBlock) {
                if (self::processDeclarationBlock($item, $scopeAttr, $keyframesMap, $format, $inKeyframes)) {
                    $kept[] = $item;
                }

                continue;
            }

            if ($item instanceof KeyFrame) {
                $rawName = trim($item->getAnimationName(), " \t\n\r\0\x0B\"'");
                if ($rawName === '' || ! preg_match('/^[a-zA-Z0-9_-]+$/', $rawName)) {
                    continue;
                }
                self::processList($item, $scopeAttr, $keyframesMap, $format, true);
                if ($item->getContents() !== []) {
                    $kept[] = $item;
                }

                continue;
            }

            if ($item instanceof AtRuleBlockList) {
                $atName = strtolower($item->atRuleName());
                if (! in_array($atName, self::ALLOWED_AT_BLOCKS, true)) {
                    continue;
                }
                $args = $item->atRuleArgs();
                if (self::hasForbiddenValue($args)) {
                    continue;
                }
                self::processList($item, $scopeAttr, $keyframesMap, $format, false);
                if ($item->getContents() === []) {
                    continue;
                }
                // Width media queries answer to the section's own width (previews in device frames, Builder).
                $container = $atName === 'media' ? self::containerArgs($args) : null;
                if ($container !== null) {
                    $converted = new AtRuleBlockList('container', $container);
                    $converted->setContents($item->getContents());
                    $item = $converted;
                }
                $kept[] = $item;

                continue;
            }

            // Everything else (@import, @font-face, @charset, @namespace, @page, @layer, unknown at-rules) is dropped.
        }

        $list->setContents($kept);
    }

    /**
     * «(min-width: 640px)», «screen and (max-width: 40rem)»… → «aisec (min-width: 640px)»; null when the
     * media query uses anything but widths (kept as a media query).
     */
    public static function containerArgs(string $args): ?string
    {
        $query = trim((string) preg_replace('/^\s*(only\s+)?(screen|all)\s+and\s+/i', '', trim($args)));
        $width = '\(\s*(min|max)-width\s*:\s*[0-9.]+(px|rem|em)\s*\)';
        if (! preg_match('/^'.$width.'(\s+and\s+'.$width.')*$/i', $query)) {
            return null;
        }

        return 'aisec '.$query;
    }

    /**
     * @param  array<string, string>  $keyframesMap
     */
    private static function processDeclarationBlock(
        DeclarationBlock $block,
        string $scopeAttr,
        array $keyframesMap,
        OutputFormat $format,
        bool $inKeyframes,
    ): bool {
        $isPseudoBeforeAfter = false;

        if ($inKeyframes) {
            $validKeyframeSelectors = [];
            foreach ($block->getSelectors() as $sel) {
                $selStr = trim($sel->render($format));
                if ($selStr === 'from' || $selStr === 'to' || preg_match('/^\d+(?:\.\d+)?%$/', $selStr)) {
                    $validKeyframeSelectors[] = new KeyframeSelector($selStr);
                }
            }
            if ($validKeyframeSelectors === []) {
                return false;
            }
            $block->setSelectors($validKeyframeSelectors);
        } else {
            $scopedSelectors = [];
            $allBeforeAfter = true;

            foreach ($block->getSelectors() as $sel) {
                $rawSel = trim($sel->render($format));
                if ($rawSel === '' || str_contains($rawSel, '&') || str_contains($rawSel, '\\') || str_contains($rawSel, '__AI_BSLASH__')) {
                    continue;
                }

                $scoped = self::scopeSelector($rawSel, $scopeAttr);
                if ($scoped === null) {
                    continue;
                }

                try {
                    $scopedSelectors[] = new Selector($scoped);
                } catch (Throwable) {
                    continue;
                }

                if (! preg_match('/::?(?:before|after)$/i', $rawSel)) {
                    $allBeforeAfter = false;
                }
            }

            if ($scopedSelectors === []) {
                return false;
            }

            $block->setSelectors($scopedSelectors);
            $isPseudoBeforeAfter = $allBeforeAfter;
        }

        $keptDeclarations = [];
        foreach ($block->getDeclarations() as $decl) {
            $cleaned = self::cleanDeclaration($decl, $keyframesMap, $format, $isPseudoBeforeAfter);
            if ($cleaned !== null) {
                $keptDeclarations[] = $cleaned;
            }
        }

        if ($keptDeclarations === []) {
            return false;
        }

        $block->setDeclarations($keptDeclarations);

        return true;
    }

    private static function scopeSelector(string $selector, string $scopeAttr): ?string
    {
        $trimmed = trim($selector);
        if ($trimmed === '') {
            return null;
        }

        if (str_starts_with($trimmed, $scopeAttr)) {
            return $trimmed;
        }

        // Replace leading :root, html, or body (or sequences like "html body") with the scope root itself
        if (preg_match('/^(?:(?::root|html|body)(?=$|\s|[>+~.#:\[]))+(\s*.*)$/i', $trimmed, $m)) {
            $rest = $m[1];

            return $scopeAttr.$rest;
        }

        return $scopeAttr.' '.$trimmed;
    }

    /**
     * @param  array<string, string>  $keyframesMap
     */
    private static function cleanDeclaration(
        Declaration $decl,
        array $keyframesMap,
        OutputFormat $format,
        bool $isPseudoBeforeAfter,
    ): ?Declaration {
        $prop = strtolower(trim($decl->getPropertyName()));
        $rawVal = $decl->getValue();
        $valStr = trim($rawVal instanceof Value ? $rawVal->render($format) : (string) $rawVal);

        if ($valStr === '' || str_contains($prop, '__AI_BSLASH__') || self::hasForbiddenValue($valStr)) {
            return null;
        }

        // Forbidden properties
        if (in_array($prop, ['behavior', '-moz-binding', 'cursor'], true)) {
            return null;
        }

        // content is allowed ONLY in ::before / ::after when it is one quoted string <= 40 chars or ""
        if ($prop === 'content') {
            if (! $isPseudoBeforeAfter) {
                return null;
            }
            if (! self::isValidPseudoContent($valStr)) {
                return null;
            }
            $decl->setValue($valStr);

            return $decl;
        }

        // position: fixed | sticky -> relative
        if ($prop === 'position') {
            $lowerVal = strtolower($valStr);
            if (in_array($lowerVal, ['fixed', 'sticky', '-webkit-sticky'], true)) {
                $decl->setValue('relative');
            }

            return $decl;
        }

        // z-index: clamp to 0..10
        if ($prop === 'z-index') {
            if (strtolower($valStr) === 'auto') {
                return $decl;
            }
            if (is_numeric($valStr)) {
                $clamped = max(0, min(10, (int) round((float) $valStr)));
                $decl->setValue((string) $clamped);

                return $decl;
            }

            return null;
        }

        // font-family: only var(--ai-font-body), var(--ai-font-display) or inherit; else var(--ai-font-body)
        if ($prop === 'font-family') {
            $normalized = (string) preg_replace('/\s+/', '', strtolower($valStr));
            $allowedMap = [
                'var(--ai-font-body)' => 'var(--ai-font-body)',
                'var(--ai-font-display)' => 'var(--ai-font-display)',
                'inherit' => 'inherit',
            ];
            $decl->setValue($allowedMap[$normalized] ?? 'var(--ai-font-body)');

            return $decl;
        }

        // Rewrite animation / animation-name references to renamed keyframes
        if (in_array($prop, ['animation', 'animation-name', '-webkit-animation', '-webkit-animation-name'], true) && $keyframesMap !== []) {
            $rewritten = $valStr;
            foreach ($keyframesMap as $oldName => $newName) {
                $rewritten = (string) preg_replace(
                    '/(?<![a-zA-Z0-9_-])'.preg_quote($oldName, '/').'(?![a-zA-Z0-9_-])/',
                    $newName,
                    $rewritten,
                );
            }
            $decl->setValue($rewritten);
        }

        return $decl;
    }

    private static function hasForbiddenValue(string $value): bool
    {
        if (str_contains($value, '\\') || str_contains($value, '__AI_BSLASH__')) {
            return true;
        }

        return (bool) preg_match('/(?:url\s*\(|expression\s*\(|javascript\s*:|@import)/i', $value);
    }

    private static function isValidPseudoContent(string $valStr): bool
    {
        if ($valStr === '""' || $valStr === "''") {
            return true;
        }

        if (preg_match('/^(["\'])(.*)\1$/s', $valStr, $m)) {
            $inner = $m[2];
            if (str_contains($inner, $m[1]) || str_contains($inner, '\\')) {
                return false;
            }

            return mb_strlen($inner, 'UTF-8') <= 40;
        }

        return false;
    }
}
