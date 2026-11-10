<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Enums\BillingPeriod;
use App\Enums\PlanFeature;
use App\Enums\PlanLimit;
use App\Rules\CairoDateTime;
use App\Support\CairoTime;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * A whole plan in one request: details, a price per period (null = not sold that way) and
 * every feature / limit value (limits: number or null = unlimited).
 */
final class PlanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $creating = $this->isMethod('post');
        $maxDiscount = (int) config('landing.billing.max_discount_percent');

        $rules = [
            'name' => ['required', 'string', 'max:60'],
            'tagline' => ['nullable', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'marketing_points' => ['nullable', 'array', 'max:10'],
            'marketing_points.*' => ['string', 'max:120'],
            'is_public' => ['required', 'boolean'],
            'is_highlighted' => ['required', 'boolean'],
            'is_archived' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'between:0,1000'],
            'prices' => ['required', 'array'],
            'values' => ['required', 'array'],
        ];

        if ($creating) {
            $rules['key'] = ['required', 'string', 'regex:/^[a-z][a-z0-9_]{1,39}$/', Rule::unique('plans', 'key')];
        }

        foreach (BillingPeriod::cases() as $period) {
            $p = 'prices.'.$period->value;
            $rules[$p] = ['present', 'nullable', 'array'];
            $rules[$p.'.price'] = ['required_with:'.$p, 'numeric', 'min:0', 'max:1000000', 'decimal:0,2'];
            $rules[$p.'.discount_percent'] = ['nullable', 'integer', 'between:0,'.$maxDiscount];
            $rules[$p.'.discount_starts_at'] = ['nullable', new CairoDateTime];
            $rules[$p.'.discount_ends_at'] = ['nullable', new CairoDateTime];
            $rules[$p.'.is_active'] = ['required_with:'.$p, 'boolean'];
        }

        foreach (PlanFeature::cases() as $feature) {
            $rules['values.'.$feature->value] = ['required', 'boolean'];
        }
        foreach (PlanLimit::cases() as $limit) {
            $rules['values.'.$limit->value] = ['present', 'nullable', 'integer', 'between:0,1000000'];
        }

        return $rules;
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            foreach (BillingPeriod::cases() as $period) {
                $starts = CairoTime::parse($this->input("prices.{$period->value}.discount_starts_at"));
                $ends = CairoTime::parse($this->input("prices.{$period->value}.discount_ends_at"));
                if ($starts !== null && $ends !== null && $ends->lte($starts)) {
                    $v->errors()->add("prices.{$period->value}.discount_ends_at", __('validation.after', ['attribute' => 'نهاية الخصم', 'date' => 'بدايته']));
                }
            }

            $sold = array_filter(BillingPeriod::cases(), fn (BillingPeriod $p) => is_array($this->input('prices.'.$p->value)));
            if ($sold === []) {
                $v->errors()->add('prices', __('admin.plan_needs_price'));
            }
        });
    }
}
