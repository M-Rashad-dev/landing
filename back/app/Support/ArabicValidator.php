<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Validation\Validator;

/**
 * Every validation message names its field in Arabic, whichever form it comes from: the exact
 * key or its wildcard form (lang/ar/attributes.php, used by all validators), else its last parts
 * (rates.0.fee → «الرسوم»), else «الحقل ده» — never a raw key like "category_ids.0".
 */
final class ArabicValidator extends Validator
{
    public function getDisplayableAttribute($attribute)
    {
        $primary = $this->getPrimaryAttribute($attribute);

        foreach (array_unique([$attribute, $primary]) as $name) {
            if ($found = $this->getAttributeFromLocalArray($name)) {
                return $found;
            }
            if ($found = $this->getAttributeFromTranslations($name)) {
                return $found;
            }
        }

        // The parts that are names (not list positions), shorter and shorter: "draft.settings.colors.primary" →
        // "settings.colors.primary", "colors.primary", "primary"; "category_ids.*" → "category_ids".
        $parts = array_values(array_filter(explode('.', $primary), fn (string $part): bool => $part !== '*' && ! ctype_digit($part)));
        for ($i = 0; $i < count($parts); $i++) {
            $suffix = implode('.', array_slice($parts, $i));
            if ($found = $this->getAttributeFromLocalArray($suffix) ?: $this->getAttributeFromTranslations($suffix)) {
                return $found;
            }
        }

        return (string) __('validation.this_field');
    }
}
