<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions;

use App\Actions\Products\SaveProduct;
use App\Ai\Ai;
use App\Ai\AiUnavailable;
use App\Ai\Copilot\Changes\JobEstimate;
use App\Ai\Copilot\Changes\JobResult;
use App\Ai\Copilot\Changes\Selector;
use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\CopilotCatalog;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Resources\ProductsResource;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Ai\Copilot\Support\FormRequestRunner;
use App\Ai\Designer\AiDesigner;
use App\Exceptions\ApiException;
use App\Http\Requests\Dashboard\ProductRequest;
use App\Imports\Products\SpecCells;
use App\Jobs\RevalidateTenantHosts;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;
use App\Models\Product;
use App\Models\ProductSpecRow;
use App\Models\ProductSpecTable;
use App\Store\Specs\ProductSpecs;
use Illuminate\Support\Collection;

/**
 * «املأ مواصفات المنتجات دي من الوصف» (docs/plans/tekno/PLAN.md §1.6): for products with spec tables, the AI proposes
 * values for their empty rows from the product's own texts (never invented: a row the texts don't state stays
 * empty), estimated first, then previewed before → after per product; «نفّذ» saves through the product request,
 * «تراجع» within 24 h puts the empty values back. Rows are never added.
 */
final class ProductsFillSpecs extends CopilotAction
{
    public const MAX = 200;

    public const BATCH = 10;

    public const MAX_OUTPUT = 4000;

    public function __construct(private readonly Ai $ai, private readonly CopilotCatalog $catalog) {}

    public function key(): string
    {
        return 'products.fill_specs';
    }

    public function label(): string
    {
        return 'ملء المواصفات من الوصف';
    }

    public function summary(): string
    {
        return 'Fill the empty spec rows («المواصفات») of up to 200 products from their own name and description with AI (only products that already have spec tables; values the texts do not state stay empty; no rows are added). To give products spec tables first, use the spec_groups resource and the group page («أضف المجموعة لمنتجات»).';
    }

    public function schema(): array
    {
        return ['type' => 'object', 'properties' => [
            'selector' => ['type' => 'object', 'description' => 'Like update_records: {"ids"} | {"filters"} | {"context"}. Default: all products.'],
        ]];
    }

    public function approval(): bool
    {
        return true;
    }

    public function costly(): bool
    {
        return true;
    }

    public function columns(): array
    {
        return ['specs' => [(string) __('ai.copilot.specs_column'), 'text']];
    }

    public function estimate(array $args, CopilotContext $ctx): JobEstimate
    {
        $resource = $this->catalog->resource('products', $ctx) ?? throw new CopilotToolError('Products are not available.');
        $ids = Selector::ids($resource, is_array($args['selector'] ?? null) ? $args['selector'] : ['filters' => []], $ctx);
        $products = $this->products($ids)->filter(fn (Product $p) => self::empty($p) !== []);
        if ($products->isEmpty()) {
            throw new CopilotToolError('None of these products has an empty spec row. Products get spec tables from a spec group (spec_groups) or the product form first.');
        }
        if ($products->count() > self::MAX) {
            throw new CopilotToolError('That is '.$products->count().' products; one run fills at most '.self::MAX.'. Narrow the selection.');
        }
        $usd = 0.0;
        foreach ($products->chunk(self::BATCH) as $batch) {
            $usd += Ai::estimate(Ai::model('copilot_content'), $this->messages($batch), self::MAX_OUTPUT);
        }

        return new JobEstimate(
            summary: (string) __('ai.copilot.specs_fill_summary', ['count' => $products->count()]),
            count: $products->count(),
            usd: $usd,
            spec: ['ids' => $products->keys()->values()->all()],
        );
    }

    public function work(CopilotChangeSet $set, CopilotContext $ctx): JobResult
    {
        $products = $this->products(array_map('intval', (array) ($set->spec['ids'] ?? [])));
        $items = [];
        $stop = null;

        foreach ($products->chunk(self::BATCH) as $batch) {
            if ($stop !== null) {
                foreach ($batch as $p) {
                    $items[] = $this->failed($p, $stop);
                }

                continue;
            }
            try {
                $reply = $this->ai->chatPaid($ctx->tenant, 'copilot', 'copilot_content', $this->messages($batch), ['max_tokens' => self::MAX_OUTPUT, 'json' => true], (string) __('ai.copilot.specs_fill_charge'));
                $json = AiDesigner::decodeJson($reply->text);
                $written = collect(is_array($json) ? (array) ($json['products'] ?? []) : [])->filter(fn ($r) => is_array($r) && isset($r['id']))->keyBy(fn ($r) => (int) $r['id']);
            } catch (ApiException $e) {
                // The balance ran out: what was filled so far is kept, the rest is listed.
                $stop = $e->getMessage();
                foreach ($batch as $p) {
                    $items[] = $this->failed($p, $stop);
                }

                continue;
            } catch (AiUnavailable $e) {
                $why = $e->reasonText().' '.__('ai.copilot.not_charged');
                $stop = $e->retryable() ? null : $why;
                foreach ($batch as $p) {
                    $items[] = $this->failed($p, $why);
                }

                continue;
            }
            foreach ($batch as $product) {
                $items[] = $this->item($product, (array) (($written->get($product->id) ?? [])['values'] ?? []));
            }
        }

        // Applied by this action (apply() below), so the preview, «نفّذ» and «تراجع» come back here.
        return new JobResult($this->key(), (string) __('ai.copilot.specs_fill_result', ['count' => count(array_filter($items, fn ($i) => ($i['status'] ?? CopilotChangeItem::PENDING) === CopilotChangeItem::PENDING))]), $items);
    }

    /** The product's values now for the item's rows (the stale check). */
    public function current(CopilotChangeItem $item, CopilotContext $ctx): ?array
    {
        $product = Product::query()->with('specTables.rows')->find($item->entity_id);
        if ($product === null) {
            return ['gone' => true];
        }
        $now = self::values($product);
        $out = [];
        foreach (array_keys((array) (((array) $item->before)['specs'] ?? [])) as $key) {
            $out[$key] = $now[$key] ?? null;
        }

        return ['specs' => $out];
    }

    /** Writes the item's values (the revert writes the empty ones back) through the product request. */
    public function apply(CopilotChangeItem $item, CopilotChangeSet $set, CopilotContext $ctx): void
    {
        $product = Product::query()->with(['categories:id,name', 'media', 'inputs', 'specTables.rows'])->findOrFail($item->entity_id);
        $after = (array) (((array) $item->after)['specs'] ?? []);
        $tables = app(ProductSpecs::class)->current($product);
        foreach ($tables as $t => $table) {
            foreach ($table['rows'] as $r => $row) {
                $key = SpecCells::header($table['name'], $row['label']);
                if (array_key_exists($key, $after)) {
                    $tables[$t]['rows'][$r]['value'] = $after[$key];
                }
            }
        }
        $resource = app(ProductsResource::class);
        $request = FormRequestRunner::run(ProductRequest::class, [...$resource->body($product), 'specs' => $tables], $ctx->user, $resource->routeParameter(), $product);
        app(SaveProduct::class)->handle($request->validated(), $product, false);
        RevalidateTenantHosts::dispatch($ctx->tenant->id)->afterCommit();
    }

    /**
     * @param  Collection<int, Product>  $batch
     * @return list<array<string, mixed>>
     */
    private function messages(Collection $batch): array
    {
        $payload = ['products' => $batch->map(fn (Product $p) => [
            'id' => $p->id,
            'name' => $p->name,
            'categories' => $p->categories->pluck('name')->all(),
            'short_description' => (string) $p->short_description,
            'description' => mb_substr(strip_tags((string) $p->description), 0, 3000),
            'empty' => self::empty($p),
        ])->values()->all()];

        return [
            ['role' => 'system', 'content' => (string) file_get_contents(resource_path('prompts/copilot-specs.md'))],
            ['role' => 'user', 'content' => (string) json_encode($payload, JSON_UNESCAPED_UNICODE)],
        ];
    }

    /**
     * Only the product's empty rows, written exactly as given; anything else from the model is dropped.
     *
     * @param  array<int, mixed>  $values
     * @return array<string, mixed>
     */
    private function item(Product $product, array $values): array
    {
        $empty = [];
        foreach (self::empty($product) as $row) {
            $empty[ProductSpecs::key($row['table']).'|'.ProductSpecs::key($row['label'])] = SpecCells::header($row['table'], $row['label']);
        }
        $before = [];
        $after = [];
        foreach ($values as $value) {
            if (! is_array($value)) {
                continue;
            }
            $key = $empty[ProductSpecs::key((string) ($value['table'] ?? '')).'|'.ProductSpecs::key((string) ($value['label'] ?? ''))] ?? null;
            $text = mb_substr(trim(strip_tags((string) ($value['value'] ?? ''))), 0, 200);
            if ($key === null || $text === '' || isset($after[$key])) {
                continue;
            }
            $before[$key] = null;
            $after[$key] = $text;
        }
        if ($after === []) {
            return $this->failed($product, (string) __('ai.copilot.specs_fill_none'));
        }

        return ['entity_id' => $product->id, 'label' => $product->name, 'before' => ['specs' => $before], 'after' => ['specs' => $after]];
    }

    /** @return array<string, mixed> */
    private function failed(Product $product, string $why): array
    {
        return ['entity_id' => $product->id, 'label' => $product->name, 'before' => [], 'after' => [], 'status' => CopilotChangeItem::FAILED, 'note' => $why];
    }

    /** @return list<array{table: string, label: string}> */
    private static function empty(Product $product): array
    {
        $out = [];
        foreach ($product->specTables as $table) {
            /** @var ProductSpecTable $table */
            foreach ($table->rows as $row) {
                /** @var ProductSpecRow $row */
                if (trim((string) $row->value) === '') {
                    $out[] = ['table' => $table->name, 'label' => $row->label];
                }
            }
        }

        return $out;
    }

    /** @return array<string, string|null> «الجدول: الصف» → value */
    private static function values(Product $product): array
    {
        $out = [];
        foreach ($product->specTables as $table) {
            foreach ($table->rows as $row) {
                $out[SpecCells::header($table->name, $row->label)] = trim((string) $row->value) === '' ? null : $row->value;
            }
        }

        return $out;
    }

    /**
     * @param  list<int>  $ids
     * @return Collection<int, Product>
     */
    private function products(array $ids): Collection
    {
        return Product::query()->with(['categories:id,name', 'specTables.rows'])->whereKey($ids)->orderBy('id')->get()->keyBy('id');
    }
}
