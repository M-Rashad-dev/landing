<?php

declare(strict_types=1);

namespace App\Http\Requests\Dashboard;

use App\Enums\OptionDisplayType;
use App\Http\Requests\ApiRequest;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;
use App\Rules\TenantExists;
use App\Support\Money;
use Illuminate\Validation\Validator;

/** Create or full update (nested options/values/media sync) of a product. */
final class ProductRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        $merge = [];

        foreach (['name', 'sku'] as $key) {
            if (is_string($this->input($key))) {
                $value = trim(strip_tags($this->input($key)));
                $merge[$key] = $value === '' ? null : $value;
            }
        }

        if (is_string($this->input('description'))) {
            $value = trim($this->input('description'));
            $merge['description'] = $value === '' ? null : $value;
        }

        if ($this->input('compare_at_price') === '') {
            $merge['compare_at_price'] = null;
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

        $this->merge($merge);
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
            'sku' => ['nullable', 'string', 'max:60'],
            'is_active' => ['sometimes', 'boolean'],

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
            'options.*.values.*.price_delta' => ['sometimes', ...$money, 'min:0', 'max:9999999.99'],
            'options.*.values.*.is_active' => ['sometimes', 'boolean'],
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
        });
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
