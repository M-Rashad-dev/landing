<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Rules\SafeUrl;
use App\Rules\TenantExists;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Store settings: on / off, theme, display settings, header / footer menus, SEO. */
final class StoreRequest extends FormRequest
{
    public const MENU_TYPES = ['home', 'all_products', 'category', 'product', 'page', 'landing', 'url'];

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $item = fn (string $p) => [
            "{$p}.type" => ['required', Rule::in(self::MENU_TYPES)],
            "{$p}.label" => ['required', 'string', 'max:40'],
            "{$p}.target_id" => ['nullable', 'integer', 'min:1'],
            "{$p}.url" => ["required_if:{$p}.type,url", 'nullable', 'string', 'max:500', new SafeUrl],
        ];

        return [
            'is_enabled' => ['sometimes', 'boolean'],
            'theme_key' => ['sometimes', 'string', 'max:40'],
            'settings' => ['sometimes', 'array'],
            'settings.announcement' => ['nullable', 'string', 'max:200'],
            'settings.products_per_page' => ['sometimes', 'integer', 'between:8,60'],
            'settings.show_whatsapp' => ['sometimes', 'boolean'],
            'settings.show_out_of_stock' => ['sometimes', 'boolean'],
            'menus' => ['sometimes', 'array'],
            'menus.header' => ['present_with:menus', 'array', 'max:12'],
            'menus.footer' => ['present_with:menus', 'array', 'max:20'],
            ...$item('menus.header.*'),
            ...$item('menus.footer.*'),
            'menus.header.*.children' => ['nullable', 'array', 'max:12'],
            ...$item('menus.header.*.children.*'),
            'seo' => ['sometimes', 'nullable', 'array'],
            'seo.title' => ['nullable', 'string', 'max:70'],
            'seo.description' => ['nullable', 'string', 'max:170'],
            'seo.og_media_id' => ['nullable', 'integer', TenantExists::table('media')],
        ];
    }

    /** Menus with clean labels and only the fields each item type uses. @return array<string, mixed> */
    public function cleaned(): array
    {
        $data = $this->validated();
        if (isset($data['settings']['announcement'])) {
            $data['settings']['announcement'] = trim(strip_tags((string) $data['settings']['announcement'])) ?: null;
        }
        if (isset($data['menus'])) {
            $clean = function (array $item, bool $withChildren) use (&$clean): array {
                $row = [
                    'type' => $item['type'],
                    'label' => trim(strip_tags((string) $item['label'])),
                    'target_id' => in_array($item['type'], ['category', 'product', 'page', 'landing'], true) ? ($item['target_id'] ?? null) : null,
                    'url' => $item['type'] === 'url' ? ($item['url'] ?? null) : null,
                ];
                if ($withChildren) {
                    $row['children'] = array_map(fn (array $c) => $clean($c, false), $item['children'] ?? []);
                }

                return $row;
            };
            $data['menus'] = [
                'header' => array_map(fn (array $i) => $clean($i, true), $data['menus']['header'] ?? []),
                'footer' => array_map(fn (array $i) => $clean($i, false), $data['menus']['footer'] ?? []),
            ];
        }

        return $data;
    }
}
