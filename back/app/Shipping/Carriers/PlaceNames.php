<?php

declare(strict_types=1);

namespace App\Shipping\Carriers;

/**
 * Matches our place names (the 27 governorates in Arabic, the customer's free-text city) to a carrier's list,
 * ignoring the usual spelling differences (أ/إ/ا، ة/ه، ى/ي، «ال», spaces and dashes; El-/Al- in English).
 */
final class PlaceNames
{
    /** Our governorates (config landing.governorates) in English, as carriers usually name them. */
    private const ENGLISH = [
        'القاهرة' => ['Cairo'], 'الجيزة' => ['Giza'], 'الإسكندرية' => ['Alexandria'], 'القليوبية' => ['Qalyubia', 'Kalyoubia', 'Qaliubiya'],
        'الشرقية' => ['Sharqia', 'Sharkia', 'Al Sharqia'], 'الدقهلية' => ['Dakahlia', 'Dakahleya'], 'الغربية' => ['Gharbia', 'Gharbeya'],
        'المنوفية' => ['Monufia', 'Menofia', 'Menoufia'], 'البحيرة' => ['Beheira', 'Behira'], 'كفر الشيخ' => ['Kafr El Sheikh', 'Kafr Alsheikh'],
        'دمياط' => ['Damietta'], 'بورسعيد' => ['Port Said'], 'الإسماعيلية' => ['Ismailia'], 'السويس' => ['Suez'],
        'الفيوم' => ['Fayoum', 'Faiyum'], 'بني سويف' => ['Beni Suef', 'Bani Suef'], 'المنيا' => ['Minya', 'Menya'], 'أسيوط' => ['Assiut', 'Asyut'],
        'سوهاج' => ['Sohag'], 'قنا' => ['Qena'], 'الأقصر' => ['Luxor'], 'أسوان' => ['Aswan'], 'البحر الأحمر' => ['Red Sea'],
        'الوادي الجديد' => ['New Valley'], 'مطروح' => ['Matrouh', 'Marsa Matrouh'], 'شمال سيناء' => ['North Sinai'], 'جنوب سيناء' => ['South Sinai'],
    ];

    /** One spelling for comparing: no diacritics, unified letters, no «ال» / El- / Al-, no spaces or punctuation. */
    public static function key(?string $name): string
    {
        $text = mb_strtolower(trim((string) $name));
        $text = (string) preg_replace('/[\x{064B}-\x{0652}\x{0640}]/u', '', $text);
        $text = strtr($text, ['أ' => 'ا', 'إ' => 'ا', 'آ' => 'ا', 'ة' => 'ه', 'ى' => 'ي', 'ؤ' => 'و', 'ئ' => 'ي']);
        $words = preg_split('/[\s\-_.,،\/()]+/u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $words = array_map(fn (string $w) => (string) preg_replace('/^(ال|el|al)(?=\p{L}{2,})/u', '', $w), $words);

        return implode('', array_filter($words, fn (string $w) => ! in_array($w, ['el', 'al', 'محافظه', 'governorate'], true)));
    }

    /**
     * The id of the carrier city that is this governorate.
     *
     * @param  list<array{id: string, names: list<string>}>  $cities
     */
    public static function governorate(string $governorate, array $cities): ?string
    {
        $wanted = array_map([self::class, 'key'], [$governorate, ...(self::ENGLISH[$governorate] ?? [])]);
        foreach ($cities as $city) {
            foreach ($city['names'] as $name) {
                if ($name !== '' && in_array(self::key($name), $wanted, true)) {
                    return $city['id'];
                }
            }
        }

        return null;
    }

    /**
     * The one area whose name is the customer's city (null when none or several match: the merchant picks).
     *
     * @param  list<array{id: string, names: list<string>}>  $areas
     */
    public static function area(?string $city, array $areas): ?string
    {
        $wanted = self::key($city);
        if (mb_strlen($wanted) < 2) {
            return null;
        }
        $found = [];
        foreach ($areas as $area) {
            foreach ($area['names'] as $name) {
                if ($name !== '' && self::key($name) === $wanted) {
                    $found[$area['id']] = true;
                }
            }
        }

        return count($found) === 1 ? (string) array_key_first($found) : null;
    }
}
