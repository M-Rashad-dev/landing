<?php

declare(strict_types=1);

namespace App\Store\Digital;

use App\Models\Product;
use App\Models\ProductCode;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;
use App\Models\ProductVariant;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A codes product's list, per option combination (the required options' values, like variant stock): what the
 * merchant adds, edits and orders. Adding entries also serves paid orders that were waiting for codes.
 */
final class DigitalCodes
{
    public function __construct(private readonly DigitalDeliveries $deliveries) {}

    /**
     * Every combination codes can belong to, with its label ("" = no options).
     *
     * @return list<array{key: string, label: string}>
     */
    public function combinations(Product $product): array
    {
        $product->loadMissing('options.values');
        $dims = $product->options->where('is_required', true)->values()
            ->map(fn (ProductOption $o) => $o->values->filter(fn (ProductOptionValue $v) => $v->is_active)->values())
            ->filter(fn ($values) => $values->isNotEmpty())->values();
        if ($dims->isEmpty()) {
            return [['key' => '', 'label' => '']];
        }
        $combos = [[]];
        foreach ($dims as $values) {
            $next = [];
            foreach ($combos as $prefix) {
                foreach ($values as $value) {
                    $next[] = [...$prefix, $value];
                }
            }
            $combos = $next;
        }

        return array_map(fn (array $values) => [
            'key' => ProductVariant::keyFor(array_map(fn (ProductOptionValue $v) => $v->id, $values)),
            'label' => implode(' / ', array_map(fn (ProductOptionValue $v) => $v->label, $values)),
        ], array_slice($combos, 0, 300));
    }

    /** @return array{combinations: list<array{key: string, label: string, left: int, count: int}>, codes: list<array<string, mixed>>} */
    public function list(Product $product, string $key): array
    {
        $counts = ProductCode::query()->where('product_id', $product->id)
            ->selectRaw('combination_key, sum(uses_left) as left_count, count(*) as rows_count')->groupBy('combination_key')->get()->keyBy('combination_key');

        return [
            'combinations' => array_map(fn (array $c) => [
                ...$c,
                'left' => (int) ($counts->get($c['key'])?->getAttribute('left_count') ?? 0),
                'count' => (int) ($counts->get($c['key'])?->getAttribute('rows_count') ?? 0),
            ], $this->combinations($product)),
            'codes' => ProductCode::query()->where('product_id', $product->id)->where('combination_key', $key)->orderBy('position')->orderBy('id')->get()
                ->map(fn (ProductCode $c) => ['id' => $c->id, 'code' => $c->code, 'uses_total' => $c->uses_total, 'uses_left' => $c->uses_left])->values()->all(),
        ];
    }

    /** @param list<array{code: string, uses?: int|null}> $entries appended after the existing ones */
    public function add(Product $product, string $key, array $entries): void
    {
        DB::transaction(function () use ($product, $key, $entries): void {
            if (ProductCode::query()->where('product_id', $product->id)->count() + count($entries) > ProductCode::MAX) {
                throw ValidationException::withMessages(['codes' => [__('digital.codes_max', ['max' => ProductCode::MAX])]]);
            }
            $position = (int) ProductCode::query()->where('product_id', $product->id)->where('combination_key', $key)->max('position');
            foreach ($entries as $entry) {
                $code = trim(str_replace("\r\n", "\n", (string) $entry['code']));
                if ($code === '') {
                    continue;
                }
                $uses = max(1, (int) ($entry['uses'] ?? 1));
                ProductCode::query()->create(['product_id' => $product->id, 'combination_key' => $key, 'code' => $code, 'uses_total' => $uses, 'uses_left' => $uses, 'position' => ++$position]);
            }
        });
        // Paid orders that were waiting for codes get theirs now.
        $this->deliveries->fillWaiting($product);
    }

    public function edit(ProductCode $code, string $text, int $usesLeft): void
    {
        $code->forceFill(['code' => trim(str_replace("\r\n", "\n", $text)), 'uses_left' => $usesLeft, 'uses_total' => max($code->uses_total, $usesLeft)])->save();
        $product = Product::query()->find($code->product_id);
        if ($product !== null && $usesLeft > 0) {
            $this->deliveries->fillWaiting($product);
        }
    }

    /** @param list<int> $ids first to last */
    public function reorder(Product $product, string $key, array $ids): void
    {
        DB::transaction(function () use ($product, $key, $ids): void {
            foreach (array_values($ids) as $i => $id) {
                ProductCode::query()->where('product_id', $product->id)->where('combination_key', $key)->whereKey($id)->update(['position' => $i + 1]);
            }
        });
    }
}
