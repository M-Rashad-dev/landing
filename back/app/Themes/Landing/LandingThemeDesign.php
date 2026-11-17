<?php

declare(strict_types=1);

namespace App\Themes\Landing;

use Illuminate\Validation\ValidationException;

/**
 * The contract of a landing theme that owns its content shape: the starter page and the
 * validation + clean-up of every save (unknown keys dropped, texts trimmed and without tags,
 * images as *_media_id(s) keys, exactly one order form that is always shown).
 *
 * Every implementation has a KEY constant ({design}_landing) and is registered in LandingThemes;
 * nothing else picks by theme key.
 */
interface LandingThemeDesign
{
    /**
     * A new page on the theme (the product name on top when there is one).
     *
     * @return array{version: int, settings: array<string, mixed>, sections: list<array<string, mixed>>}
     */
    public static function defaults(?string $productName = null): array;

    /**
     * The page content sent by the Builder, validated and cleaned.
     *
     * @return array{version: int, settings: array<string, mixed>, sections: list<array<string, mixed>>}
     *
     * @throws ValidationException keys like content.sections.2.props.title
     */
    public function validate(mixed $content, string $prefix = 'content'): array;
}
