<?php

declare(strict_types=1);

namespace App\Ai\Designer;

use DOMDocument;
use DOMElement;
use DOMNode;
use DOMText;

/**
 * Sanitizes AI-generated section HTML templates (docs/plans/ai-designer.md §3.4).
 * Walks the parsed DOM and copies only allowed elements, attributes, and text nodes into a fresh document.
 */
final class AiSectionSanitizer
{
    public const MAX_BYTES = 40000;

    public const MAX_ELEMENTS = 600;

    public const MAX_DEPTH = 25;

    private const HTML_TAGS = [
        'div', 'section', 'article', 'aside', 'header', 'footer', 'nav',
        'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'a', 'img', 'picture', 'ul', 'ol', 'li',
        'strong', 'em', 'b', 'i', 'u', 's', 'small', 'mark',
        'br', 'hr', 'figure', 'figcaption', 'blockquote', 'q',
        'button', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ];

    /** Lowercased SVG tag name => canonical mixed-case SVG tag name */
    private const SVG_TAGS = [
        'svg' => 'svg',
        'g' => 'g',
        'path' => 'path',
        'circle' => 'circle',
        'ellipse' => 'ellipse',
        'rect' => 'rect',
        'line' => 'line',
        'polyline' => 'polyline',
        'polygon' => 'polygon',
        'defs' => 'defs',
        'lineargradient' => 'linearGradient',
        'radialgradient' => 'radialGradient',
        'stop' => 'stop',
    ];

    private const DROP_WITH_CONTENT = [
        'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
        'form', 'input', 'textarea', 'select', 'option', 'link', 'meta', 'base',
        'template', 'noscript', 'video', 'audio', 'source', 'track', 'canvas',
        'math', 'foreignobject', 'use', 'image', 'animate', 'set',
    ];

    private const GLOBAL_ATTRS = ['class', 'role', 'title', 'dir'];

    private const DATA_AI_FLAG_ATTRS = [
        'data-ai-loop',
        'data-ai-track',
        'data-ai-prev',
        'data-ai-next',
        'data-ai-dots',
        'data-ai-tab',
        'data-ai-panel',
        'data-ai-item',
        'data-ai-toggle',
        'data-ai-content',
        'data-ai-single',
        'data-ai-days',
        'data-ai-hours',
        'data-ai-minutes',
        'data-ai-seconds',
        'data-ai-reveal',
    ];

    private const BEHAVIORS = ['slider', 'marquee', 'tabs', 'accordion', 'countdown'];

    private const SPEEDS = ['slow', 'normal', 'fast'];

    private const DIRECTIONS = ['normal', 'reverse'];

    /** Lowercased SVG attribute name => canonical SVG attribute name */
    private const SVG_ATTRS = [
        'viewbox' => 'viewBox',
        'fill' => 'fill',
        'stroke' => 'stroke',
        'stroke-width' => 'stroke-width',
        'stroke-linecap' => 'stroke-linecap',
        'stroke-linejoin' => 'stroke-linejoin',
        'stroke-dasharray' => 'stroke-dasharray',
        'fill-rule' => 'fill-rule',
        'clip-rule' => 'clip-rule',
        'd' => 'd',
        'cx' => 'cx',
        'cy' => 'cy',
        'r' => 'r',
        'rx' => 'rx',
        'ry' => 'ry',
        'x' => 'x',
        'y' => 'y',
        'x1' => 'x1',
        'y1' => 'y1',
        'x2' => 'x2',
        'y2' => 'y2',
        'width' => 'width',
        'height' => 'height',
        'points' => 'points',
        'transform' => 'transform',
        'offset' => 'offset',
        'stop-color' => 'stop-color',
        'stop-opacity' => 'stop-opacity',
        'opacity' => 'opacity',
        'gradientunits' => 'gradientUnits',
        'gradienttransform' => 'gradientTransform',
        'xmlns' => 'xmlns',
    ];

    /**
     * Clean raw HTML according to §3.4.
     *
     * @return array{html: string, removed: list<string>, errors: list<string>}
     */
    public static function clean(string $html): array
    {
        $removed = [];
        $errors = [];

        if (trim($html) === '') {
            return ['html' => '', 'removed' => [], 'errors' => ['Template HTML is empty.']];
        }

        // Remove any <template> or <noscript> blocks in raw string as well before DOM parsing,
        // because HTML5/libxml can parse inside <noscript> or <template> weirdly.
        $preCleaned = $html;
        foreach (['script', 'style', 'template', 'noscript', 'iframe', 'math', 'foreignObject'] as $rawDrop) {
            $pattern = '/<'.preg_quote($rawDrop, '/').'\b[^>]*>.*?<\/'.preg_quote($rawDrop, '/').'\s*>/is';
            if (preg_match($pattern, $preCleaned)) {
                $removed[] = 'tag:'.strtolower($rawDrop);
                $preCleaned = (string) preg_replace($pattern, '', $preCleaned);
            }
        }

        $prevUseErrors = libxml_use_internal_errors(true);
        $srcDoc = new DOMDocument('1.0', 'UTF-8');
        $wrapped = '<?xml encoding="UTF-8"><div id="__ai_root__">'.$preCleaned.'</div>';
        $srcDoc->loadHTML($wrapped, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        libxml_use_internal_errors($prevUseErrors);

        $srcRoot = null;
        foreach ($srcDoc->getElementsByTagName('div') as $div) {
            if ($div->getAttribute('id') === '__ai_root__') {
                $srcRoot = $div;
                break;
            }
        }

        if (! $srcRoot instanceof DOMElement) {
            return ['html' => '', 'removed' => array_values(array_unique($removed)), 'errors' => ['Could not parse template HTML.']];
        }

        $outDoc = new DOMDocument('1.0', 'UTF-8');
        $outRoot = $outDoc->createElement('div');
        $outDoc->appendChild($outRoot);

        $stats = ['elements' => 0, 'maxDepth' => 0];
        self::copyChildren($srcRoot, $outRoot, $outDoc, 1, $removed, $stats);

        $innerHtml = '';
        foreach ($outRoot->childNodes as $child) {
            $piece = $outDoc->saveHTML($child);
            if (is_string($piece)) {
                $innerHtml .= $piece;
            }
        }

        // Restore percent-encoded {{ ... }} tokens in href/src attributes caused by libxml's saveHTML
        $innerHtml = (string) preg_replace_callback(
            '/%7B%7B(.*?)%7D%7D/i',
            static fn (array $m): string => '{{'.rawurldecode($m[1]).'}}',
            $innerHtml,
        );

        // Restore mixed-case SVG tags and attributes if libxml lowercased them during saveHTML
        $innerHtml = self::restoreSvgCase($innerHtml);
        $innerHtml = trim($innerHtml);

        if ($innerHtml === '' || $stats['elements'] === 0) {
            $errors[] = 'Template HTML is empty after sanitization.';
        }
        if (strlen($innerHtml) > self::MAX_BYTES) {
            $errors[] = 'Template HTML exceeds the 40,000 byte limit.';
        }
        if ($stats['elements'] > self::MAX_ELEMENTS) {
            $errors[] = 'Template HTML exceeds the 600 element limit.';
        }
        if ($stats['maxDepth'] > self::MAX_DEPTH) {
            $errors[] = 'Template HTML exceeds the maximum nesting depth of 25.';
        }

        return [
            'html' => $innerHtml,
            'removed' => array_values(array_unique($removed)),
            'errors' => $errors,
        ];
    }

    /**
     * @param  list<string>  $removed
     * @param  array{elements: int, maxDepth: int}  $stats
     */
    private static function copyChildren(
        DOMNode $srcParent,
        DOMNode $dstParent,
        DOMDocument $outDoc,
        int $depth,
        array &$removed,
        array &$stats,
    ): void {
        foreach ($srcParent->childNodes as $child) {
            if ($child instanceof DOMText) {
                $dstParent->appendChild($outDoc->createTextNode($child->nodeValue ?? ''));

                continue;
            }

            if (! $child instanceof DOMElement) {
                continue;
            }

            $rawTag = strtolower($child->nodeName);

            if (in_array($rawTag, self::DROP_WITH_CONTENT, true)) {
                $removed[] = "tag:{$rawTag}";

                continue;
            }

            $isHtml = in_array($rawTag, self::HTML_TAGS, true);
            $isSvg = isset(self::SVG_TAGS[$rawTag]);

            if (! $isHtml && ! $isSvg) {
                $removed[] = "unwrap:{$rawTag}";
                self::copyChildren($child, $dstParent, $outDoc, $depth, $removed, $stats);

                continue;
            }

            // Special rule for <img>: src must be a single {{img ...}} token, otherwise remove the whole img
            if ($rawTag === 'img') {
                $src = trim($child->getAttribute('src'));
                if (! self::isValidImgToken($src)) {
                    $removed[] = 'img:invalid-src';

                    continue;
                }
            }

            $stats['elements']++;
            if ($depth > $stats['maxDepth']) {
                $stats['maxDepth'] = $depth;
            }

            $canonicalTag = $isSvg ? self::SVG_TAGS[$rawTag] : $rawTag;
            $newEl = $outDoc->createElement($canonicalTag);

            self::copyAttributes($child, $newEl, $rawTag, $isSvg, $removed);

            if ($rawTag === 'button') {
                $newEl->setAttribute('type', 'button');
            }

            $dstParent->appendChild($newEl);
            self::copyChildren($child, $newEl, $outDoc, $depth + 1, $removed, $stats);
        }
    }

    /**
     * @param  list<string>  $removed
     */
    private static function copyAttributes(
        DOMElement $src,
        DOMElement $dst,
        string $rawTag,
        bool $isSvg,
        array &$removed,
    ): void {
        if (! $src->hasAttributes()) {
            return;
        }

        foreach ($src->attributes as $attr) {
            $name = strtolower($attr->nodeName);
            $value = $attr->nodeValue ?? '';

            // Always remove dangerous attributes and protocols
            if (
                $name === 'style'
                || $name === 'srcset'
                || $name === 'formaction'
                || str_starts_with($name, 'on')
                || str_starts_with($name, 'xlink:')
            ) {
                $removed[] = "attr:{$name}";

                continue;
            }

            if (self::hasDangerousProtocol($value)) {
                $removed[] = "attr:{$name}";

                continue;
            }

            // id is allowed ONLY on linearGradient / radialGradient
            if ($name === 'id') {
                if (in_array($rawTag, ['lineargradient', 'radialgradient'], true) && preg_match('/^[a-zA-Z][a-zA-Z0-9_-]{0,40}$/', $value)) {
                    $dst->setAttribute('id', $value);
                } else {
                    $removed[] = 'attr:id';
                }

                continue;
            }

            // Global attributes
            if (in_array($name, self::GLOBAL_ATTRS, true)) {
                $dst->setAttribute($name, $value);

                continue;
            }

            // aria-*
            if (str_starts_with($name, 'aria-') && preg_match('/^aria-[a-z0-9-]+$/', $name)) {
                $dst->setAttribute($name, $value);

                continue;
            }

            // data-ai-*
            if (str_starts_with($name, 'data-ai-')) {
                self::handleDataAiAttr($dst, $rawTag, $name, $value, $removed);

                continue;
            }

            // Tag-specific attributes
            if ($rawTag === 'a' && $name === 'href') {
                $trimmed = trim($value);
                if (self::isValidHref($trimmed)) {
                    $dst->setAttribute('href', $trimmed);
                } else {
                    $removed[] = 'attr:href';
                }

                continue;
            }

            if ($rawTag === 'img') {
                if ($name === 'src') {
                    $dst->setAttribute('src', trim($value));

                    continue;
                }
                if ($name === 'alt') {
                    $dst->setAttribute('alt', $value);

                    continue;
                }
                if ($name === 'loading' && in_array($value, ['lazy', 'eager'], true)) {
                    $dst->setAttribute('loading', $value);

                    continue;
                }
                if (in_array($name, ['width', 'height'], true) && ctype_digit($value) && (int) $value > 0) {
                    $dst->setAttribute($name, $value);

                    continue;
                }
            }

            if ($rawTag === 'button' && $name === 'type') {
                if (strtolower($value) !== 'button') {
                    $removed[] = "attr:type={$value}";
                }
                $dst->setAttribute('type', 'button');

                continue;
            }

            if (in_array($rawTag, ['td', 'th'], true) && in_array($name, ['colspan', 'rowspan'], true)) {
                if (ctype_digit($value) && (int) $value >= 1 && (int) $value <= 20) {
                    $dst->setAttribute($name, $value);
                } else {
                    $removed[] = "attr:{$name}";
                }

                continue;
            }

            if ($isSvg && isset(self::SVG_ATTRS[$name])) {
                $dst->setAttribute(self::SVG_ATTRS[$name], $value);

                continue;
            }

            $removed[] = "attr:{$name}";
        }
    }

    /**
     * @param  list<string>  $removed
     */
    private static function handleDataAiAttr(
        DOMElement $dst,
        string $rawTag,
        string $name,
        string $value,
        array &$removed,
    ): void {
        $trimmed = trim($value);

        if ($name === 'data-ai-behavior') {
            if (in_array($trimmed, self::BEHAVIORS, true)) {
                $dst->setAttribute($name, $trimmed);
            } else {
                $removed[] = "attr:{$name}";
            }

            return;
        }

        if ($name === 'data-ai-autoplay') {
            if (ctype_digit($trimmed) && (int) $trimmed >= 1500 && (int) $trimmed <= 15000) {
                $dst->setAttribute($name, $trimmed);
            } else {
                $removed[] = "attr:{$name}";
            }

            return;
        }

        if ($name === 'data-ai-speed') {
            if (in_array($trimmed, self::SPEEDS, true)) {
                $dst->setAttribute($name, $trimmed);
            } else {
                $removed[] = "attr:{$name}";
            }

            return;
        }

        if ($name === 'data-ai-direction') {
            if (in_array($trimmed, self::DIRECTIONS, true)) {
                $dst->setAttribute($name, $trimmed);
            } else {
                $removed[] = "attr:{$name}";
            }

            return;
        }

        if ($name === 'data-ai-ends') {
            if ((bool) preg_match('/^\{\{\s*date\s+[a-z][a-z0-9_]{1,30}\s*\}\}$/', $trimmed)) {
                $dst->setAttribute($name, $trimmed);
            } else {
                $removed[] = "attr:{$name}";
            }

            return;
        }

        if ($name === 'data-ai-add') {
            if ($rawTag === 'button' && (bool) preg_match('/^\{\{\s*id\s*\}\}$/', $trimmed)) {
                $dst->setAttribute($name, $trimmed);
            } else {
                $removed[] = "attr:{$name}";
            }

            return;
        }

        if (in_array($name, self::DATA_AI_FLAG_ATTRS, true)) {
            $dst->setAttribute($name, $value);

            return;
        }

        $removed[] = "attr:{$name}";
    }

    private static function hasDangerousProtocol(string $value): bool
    {
        $decoded = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        // Strip ASCII control characters and whitespace so obfuscations like "java\tscript:" are caught
        $collapsed = (string) preg_replace('/[\x00-\x20]+/', '', $decoded);

        return (bool) preg_match('/(javascript|vbscript|data):/i', $collapsed);
    }

    private static function isValidHref(string $href): bool
    {
        if ($href === '') {
            return false;
        }

        // {{link key}} or {{order_link}}
        if (preg_match('/^\{\{\s*(?:link\s+[a-z][a-z0-9_]{1,30}|order_link)\s*\}\}$/', $href)) {
            return true;
        }

        // #anchor
        if (preg_match('/^#[a-z0-9-]{1,40}$/', $href)) {
            return true;
        }

        // Relative path starting with single / (not //)
        if (preg_match('/^\/(?!\/)[^\s<>"\']*$/', $href)) {
            return true;
        }

        // https:// without spaces
        if (preg_match('/^https:\/\/[^\s<>"\']+$/', $href)) {
            return true;
        }

        return false;
    }

    private static function isValidImgToken(string $src): bool
    {
        return (bool) preg_match('/^\{\{\s*img(?:\s+(?:product\.image|[a-z][a-z0-9_]{1,30}))?\s*\}\}$/', $src);
    }

    private static function restoreSvgCase(string $html): string
    {
        return str_replace(
            ['<lineargradient', '</lineargradient>', '<radialgradient', '</radialgradient>', 'viewbox=', 'gradientunits=', 'gradienttransform='],
            ['<linearGradient', '</linearGradient>', '<radialGradient', '</radialGradient>', 'viewBox=', 'gradientUnits=', 'gradientTransform='],
            $html,
        );
    }
}
