<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Auth\PermissionCatalog;
use App\Enums\DeliveryType;
use App\Enums\OptionDisplayType;
use App\Enums\ProductInputKind;
use App\Http\Requests\ApiRequest;
use App\Models\Product;
use App\Models\ProductInput;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;
use App\Rules\PageSlug;
use App\Rules\TenantExists;
use App\Rules\TenantUnique;
use App\Support\Money;
use Illuminate\Validation\Validator;

/** Create or full update (nested options/values/media sync) of a product. */
final class ProductRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        $merge = [];

        foreach (['name', 'sku', 'short_description', 'slug'] as $key) {
            if (is_string($this->input($key))) {
                $value = trim(strip_tags($this->input($key)));
                $merge[$key] = $value === '' ? null : $value;
            }
        }

        if (is_string($this->input('description'))) {
            $value = trim($this->input('description'));
            $merge['description'] = $value === '' ? null : $value;
        }

        foreach (['compare_at_price', 'cost'] as $key) {
            if ($this->input($key) === '') {
                $merge[$key] = null;
            }
        }

        $options = $this->input('options');
        if (is_array($options)) {
            foreach ($options as $i => $option) {
                if (! is_array($option)) {
                    continue;
                }
                if (isset($option['name']) && is_string($option['name'])) {
                    $options[$i]['name'] = trim(strip_tags($option['name']));
                }
                foreach (($option['values'] ?? []) as $j => $value) {
                    if (! is_array($value)) {
                        continue;
                    }
                    if (isset($value['label']) && is_string($value['label'])) {
                        $options[$i]['values'][$j]['label'] = trim(strip_tags($value['label']));
                    }
                    if (isset($value['color_hex']) && is_string($value['color_hex'])) {
                        $hex = strtoupper(trim($value['color_hex']));
                        $options[$i]['values'][$j]['color_hex'] = $hex === '' ? null : $hex;
                    }
                }
            }
            $merge['options'] = $options;
        }

        $inputs = $this->input('inputs');
        if (is_array($inputs)) {
            foreach ($inputs as $i => $input) {
                if (! is_array($input)) {
                    continue;
                }
                foreach (['label', 'placeholder'] as $key) {
                    if (isset($input[$key]) && is_string($input[$key])) {
                        $value = trim(strip_tags($input[$key]));
                        $inputs[$i][$key] = $value === '' ? null : $value;
                    }
                }
            }
            $merge['inputs'] = $inputs;
        }

        $this->merge($merge);
    }

    /**
     * Costs are dropped for staff without «تكلفة المنتجات» (what they never saw stays as it was).
     *
     * @param  array-key|null  $key
     */
    public function validated($key = null, $default = null): mixed
    {
        $data = parent::validated($key, $default);
        if ($key !== null || ! is_array($data) || PermissionCatalog::allows($this->user(), 'products.cost')) {
            return $data;
        }
        unset($data['cost']);
        foreach (($data['variants'] ?? []) as $i => $variant) {
            unset($data['variants'][$i]['cost']);
        }

        return $data;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $money = ['numeric', 'decimal:0,2'];

        return [
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:10000'],
            'price' => ['required', ...$money, 'gt:0', 'max:9999999.99'],
            'compare_at_price' => ['nullable', ...$money, 'max:9999999.99'],
            // What a unit costs the store (profit reports); only for whoever has «تكلفة المنتجات».
            'cost' => ['sometimes', 'nullable', ...$money, 'min:0', 'max:9999999.99'],
            'sku' => ['nullable', 'string', 'max:60'],
            'is_active' => ['sometimes', 'boolean'],

            // «منتج رقمي»: how it is delivered and its settings (downloads / the link and its opens / the message).
            'kind' => ['sometimes', 'string', 'in:'.Product::PHYSICAL.','.Product::DIGITAL],
            'delivery_type' => ['nullable', 'string', 'in:'.implode(',', DeliveryType::values())],
            'delivery_settings' => ['sometimes', 'nullable', 'array'],
            'delivery_settings.downloads' => ['nullable', 'integer', 'between:1,1000'],
            'delivery_settings.link' => ['nullable', 'string', 'max:1000', 'url:https,http'],
            'delivery_settings.opens' => ['nullable', 'integer', 'between:1,1000'],
            'delivery_settings.subject' => ['nullable', 'string', 'max:150'],
            'delivery_settings.message' => ['nullable', 'string', 'max:3000'],

            // Store fields.
            'slug' => ['sometimes', 'nullable', 'string', 'max:120', 'regex:'.PageSlug::PATTERN, TenantUnique::table('products', 'slug')->ignore($this->route('product')?->id)],
            'short_description' => ['sometimes', 'nullable', 'string', 'max:300'],
            'in_store' => ['sometimes', 'boolean'],
            'is_featured' => ['sometimes', 'boolean'],
            'category_ids' => ['sometimes', 'array', 'max:20'],
            'category_ids.*' => ['integer', 'distinct', TenantExists::table('categories')],
            'seo' => ['sometimes', 'nullable', 'array'],
            'seo.title' => ['nullable', 'string', 'max:70'],
            'seo.description' => ['nullable', 'string', 'max:170'],
            'seo.og_media_id' => ['nullable', 'integer', TenantExists::table('media')],
            'seo.noindex' => ['nullable', 'boolean'],
            'seo.keywords' => ['nullable', 'array', 'max:10'],
            'seo.keywords.*' => ['nullable', 'string', 'max:40'],
            'primary_category_id' => ['sometimes', 'nullable', 'integer', TenantExists::table('categories')],
            'stock_mode' => ['sometimes', 'string', 'in:unlimited,product,variant'],
            'stock' => ['sometimes', 'nullable', 'integer', 'between:0,1000000'],
            'low_stock_threshold' => ['sometimes', 'nullable', 'integer', 'between:0,1000000'],
            // Variant stock by option name → value label (resolved after the options are saved).
            'variants' => ['sometimes', 'array', 'max:300'],
            'variants.*.values' => ['required', 'array', 'min:1', 'max:5'],
            'variants.*.values.*' => ['string', 'max:40'],
            'variants.*.stock' => ['required', 'integer', 'between:0,1000000'],
            'variants.*.sku' => ['nullable', 'string', 'max:60'],
            'variants.*.cost' => ['sometimes', 'nullable', ...$money, 'min:0', 'max:9999999.99'],

            'media_ids' => ['sometimes', 'array', 'max:10'],
            'media_ids.*' => ['integer', 'distinct', TenantExists::table('media')],

            'options' => ['sometimes', 'array', 'max:5'],
            'options.*.id' => ['nullable', 'integer'],
            'options.*.name' => ['required', 'string', 'max:40'],
            'options.*.display_type' => ['required', 'string', 'in:'.implode(',', OptionDisplayType::values())],
            'options.*.is_required' => ['sometimes', 'boolean'],
            'options.*.values' => ['required', 'array', 'min:1', 'max:30'],
            'options.*.values.*.id' => ['nullable', 'integer'],
            'options.*.values.*.label' => ['required', 'string', 'max:40'],
            'options.*.values.*.color_hex' => ['nullable', 'string', 'regex:/^#[0-9A-F]{6}$/'],
            // A value may lower the price too (Salla-style fixed amount); the unit price never goes below 0.
            'options.*.values.*.price_delta' => ['sometimes', ...$money, 'min:-9999999.99', 'max:9999999.99'],
            'options.*.values.*.is_active' => ['sometimes', 'boolean'],

            // «حسب الطلب»: fields the customer fills (text, long text, image, file); they make no variants.
            'inputs' => ['sometimes', 'array', 'max:'.ProductInput::MAX],
            'inputs.*.id' => ['nullable', 'integer'],
            'inputs.*.kind' => ['required', 'string', 'in:'.implode(',', ProductInputKind::values())],
            'inputs.*.label' => ['required', 'string', 'max:60'],
            'inputs.*.placeholder' => ['nullable', 'string', 'max:120'],
            'inputs.*.is_required' => ['sometimes', 'boolean'],
            'inputs.*.price_delta' => ['sometimes', ...$money, 'min:0', 'max:9999999.99'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $data = $validator->getData();

            if (isset($data['compare_at_price']) && $data['compare_at_price'] !== null
                && Money::toCents((string) $data['compare_at_price']) <= Money::toCents((string) $data['price'])) {
                $validator->errors()->add('compare_at_price', __('products.compare_at_gt_price'));
            }

            $this->validateOptions($validator, $data['options'] ?? []);
            $this->validateInputs($validator, $data['inputs'] ?? []);
            if (($data['kind'] ?? null) === Product::DIGITAL) {
                if (empty($data['delivery_type'])) {
                    $validator->errors()->add('delivery_type', __('digital.type_required'));
                } elseif ($data['delivery_type'] === DeliveryType::Links->value && empty($data['delivery_settings']['link'])) {
                    $validator->errors()->add('delivery_settings.link', __('digital.link_required'));
                }
            }
        });
    }

    /** @param array<int, array<string, mixed>> $inputs */
    private function validateInputs(Validator $validator, array $inputs): void
    {
        /** @var Product|null $product */
        $product = $this->route('product');
        $own = $product ? ProductInput::query()->where('product_id', $product->id)->pluck('id')->all() : [];

        $labels = [];
        foreach ($inputs as $i => $input) {
            $label = mb_strtolower((string) $input['label']);
            if (in_array($label, $labels, true)) {
                $validator->errors()->add("inputs.{$i}.label", __('products.input_label_duplicate'));
            }
            $labels[] = $label;
            if (isset($input['id']) && ! in_array((int) $input['id'], $own, true)) {
                $validator->errors()->add("inputs.{$i}.id", __('products.input_not_found'));
            }
        }
    }

    /** @param array<int, array<string, mixed>> $options */
    private function validateOptions(Validator $validator, array $options): void
    {
        /** @var Product|null $product */
        $product = $this->route('product');
        $ownOptionIds = $product
            ? ProductOption::query()->where('product_id', $product->id)->pluck('id')->all()
            : [];

        $names = [];
        foreach ($options as $i => $option) {
            $name = mb_strtolower((string) $option['name']);
            if (in_array($name, $names, true)) {
                $validator->errors()->add("options.{$i}.name", __('products.option_name_duplicate'));
            }
            $names[] = $name;

            $optionId = isset($option['id']) ? (int) $option['id'] : null;
            if ($optionId !== null && ! in_array($optionId, $ownOptionIds, true)) {
                $validator->errors()->add("options.{$i}.id", __('products.option_not_found'));

                continue;
            }

            $ownValueIds = $optionId
                ? ProductOptionValue::query()->where('option_id', $optionId)->pluck('id')->all()
                : [];

            $labels = [];
            foreach ($option['values'] as $j => $value) {
                $label = mb_strtolower((string) $value['label']);
                if (in_array($label, $labels, true)) {
                    $validator->errors()->add("options.{$i}.values.{$j}.label", __('products.value_label_duplicate'));
                }
                $labels[] = $label;

                if ($option['display_type'] === OptionDisplayType::Swatch->value && empty($value['color_hex'])) {
                    $validator->errors()->add("options.{$i}.values.{$j}.color_hex", __('products.swatch_color_required'));
                }

                $valueId = isset($value['id']) ? (int) $value['id'] : null;
                if ($valueId !== null && ! in_array($valueId, $ownValueIds, true)) {
                    $validator->errors()->add("options.{$i}.values.{$j}.id", __('products.value_not_found'));
                }
            }
        }
    }
}
