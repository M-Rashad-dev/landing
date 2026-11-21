<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions;

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
use App\Ai\Designer\AiDesigner;
use App\Exceptions\ApiException;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;
use App\Models\Product;
use Illuminate\Support\Collection;

/**
 * Writes product texts with the AI in bulk (description, short description, SEO title / description): estimated cost
 * first, then batches of 10 products per call (charged as they go), then a before → after preview to approve.
 */
final class ProductsWriteContent extends CopilotAction
{
    public const FIELDS = ['description', 'short_description', 'seo_title', 'seo_description'];

    public const MAX = 200;

    public const BATCH = 10;

    public const MAX_OUTPUT = 6000;

    public const LIMITS = ['description' => 5000, 'short_description' => 300, 'seo_title' => 70, 'seo_description' => 170];

    public function __construct(private readonly Ai $ai, private readonly CopilotCatalog $catalog) {}

    public function key(): string
    {
        return 'products.write_content';
    }

    public function label(): string
    {
        return 'كتابة أوصاف المنتجات';
    }

    public function summary(): string
    {
        return 'Write product texts with AI for up to 200 products: description, short_description, seo_title, seo_description. By default only products whose chosen fields are empty.';
    }

    public function schema(): array
    {
        return ['type' => 'object', 'properties' => [
            'selector' => ['type' => 'object', 'description' => 'Like update_records: {"ids"} | {"filters"} | {"context"}. Default: all products.'],
            'fields' => ['type' => 'array', 'items' => ['type' => 'string', 'enum' => self::FIELDS], 'description' => 'Default ["description"].'],
            'only_empty' => ['type' => 'boolean', 'description' => 'Only products where the field is empty (default true). false = rewrite.'],
            'instructions' => ['type' => 'string', 'description' => 'The merchant\'s wishes (tone, what to mention), ≤ 500 chars.'],
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

    public function estimate(array $args, CopilotContext $ctx): JobEstimate
    {
        $fields = array_values(array_intersect(self::FIELDS, (array) ($args['fields'] ?? ['description']))) ?: ['description'];
        $resource = $this->catalog->resource('products', $ctx) ?? throw new CopilotToolError('Products are not available.');
        $ids = Selector::ids($resource, is_array($args['selector'] ?? null) ? $args['selector'] : ['filters' => []], $ctx);
        $products = $this->products($ids);
        if (($args['only_empty'] ?? true) !== false) {
            $products = $products->filter(fn (Product $p) => array_filter($fields, fn (string $f) => trim((string) $this->valueOf($p, $f)) === '') !== []);
        }
        if ($products->count() > self::MAX) {
            throw new CopilotToolError('That is '.$products->count().' products; one run writes at most '.self::MAX.'. Narrow the selection.');
        }
        $instructions = mb_substr(trim((string) ($args['instructions'] ?? '')), 0, 500);
        $usd = 0.0;
        foreach ($products->chunk(self::BATCH) as $batch) {
            $usd += Ai::estimate(Ai::model('copilot_content'), $this->messages($batch, $fields, $instructions), self::MAX_OUTPUT);
        }
        $names = array_map(fn (string $f) => (string) __('ai.copilot.content_fields.'.$f), $fields);

        return new JobEstimate(
            summary: (string) __('ai.copilot.content_summary', ['fields' => implode(' و', $names), 'count' => $products->count()]),
            count: $products->count(),
            usd: $usd,
            spec: ['ids' => $products->keys()->values()->all(), 'fields' => $fields, 'instructions' => $instructions],
        );
    }

    public function work(CopilotChangeSet $set, CopilotContext $ctx): JobResult
    {
        $fields = (array) ($set->spec['fields'] ?? ['description']);
        $instructions = (string) ($set->spec['instructions'] ?? '');
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
                $reply = $this->ai->chatPaid($ctx->tenant, 'copilot', 'copilot_content', $this->messages($batch, $fields, $instructions), ['max_tokens' => self::MAX_OUTPUT, 'json' => true], (string) __('ai.copilot.content_charge'));
                $json = AiDesigner::decodeJson($reply->text);
                $written = collect(is_array($json) ? (array) ($json['products'] ?? []) : [])->filter(fn ($r) => is_array($r) && isset($r['id']))->keyBy(fn ($r) => (int) $r['id']);
            } catch (ApiException $e) {
                // The balance ran out: what was written so far is kept, the rest is listed.
                $stop = $e->getMessage();
                foreach ($batch as $p) {
                    $items[] = $this->failed($p, $stop);
                }

                continue;
            } catch (AiUnavailable $e) {
                // Nothing was charged. A provider hiccup may pass for the next batch; anything else stops the run.
                $why = $e->reasonText().' '.__('ai.copilot.not_charged');
                $stop = $e->retryable() ? null : $why;
                foreach ($batch as $p) {
                    $items[] = $this->failed($p, $why);
                }

                continue;
            }
            foreach ($batch as $product) {
                $items[] = $this->item($product, $fields, (array) ($written->get($product->id) ?? []));
            }
        }

        return new JobResult('products', (string) __('ai.copilot.content_result', ['count' => count(array_filter($items, fn ($i) => ($i['status'] ?? CopilotChangeItem::PENDING) === CopilotChangeItem::PENDING))]), $items);
    }

    /**
     * @param  Collection<int, Product>  $batch
     * @param  list<string>  $fields
     * @return list<array<string, mixed>>
     */
    private function messages(Collection $batch, array $fields, string $instructions): array
    {
        $payload = [
            'fields' => $fields,
            'instructions' => $instructions !== '' ? $instructions : null,
            'products' => $batch->map(fn (Product $p) => [
                'id' => $p->id,
                'name' => $p->name,
                'price' => (string) $p->price,
                'categories' => $p->categories->pluck('name')->all(),
                'current' => array_filter(array_combine(self::FIELDS, array_map(fn (string $f) => mb_substr((string) $this->valueOf($p, $f), 0, 600), self::FIELDS))),
            ])->values()->all(),
        ];

        return [
            ['role' => 'system', 'content' => (string) file_get_contents(resource_path('prompts/copilot-content.md'))],
            ['role' => 'user', 'content' => (string) json_encode($payload, JSON_UNESCAPED_UNICODE)],
        ];
    }

    /**
     * @param  list<string>  $fields
     * @param  array<string, mixed>  $written
     * @return array<string, mixed>
     */
    private function item(Product $product, array $fields, array $written): array
    {
        $before = [];
        $after = [];
        foreach ($fields as $field) {
            $text = trim(strip_tags((string) ($written[$field] ?? '')));
            if ($text === '') {
                continue;
            }
            $before[$field] = $this->valueOf($product, $field);
            $after[$field] = mb_substr($text, 0, self::LIMITS[$field]);
        }
        if ($after === []) {
            return $this->failed($product, (string) __('ai.copilot.content_missing'));
        }

        return ['entity_id' => $product->id, 'label' => $product->name, 'before' => $before, 'after' => $after];
    }

    /** @return array<string, mixed> */
    private function failed(Product $product, string $why): array
    {
        return ['entity_id' => $product->id, 'label' => $product->name, 'before' => [], 'after' => [], 'status' => CopilotChangeItem::FAILED, 'note' => $why];
    }

    private function valueOf(Product $product, string $field): ?string
    {
        $value = app(ProductsResource::class)->raw($product, app(ProductsResource::class)->fieldMap()[$field]);

        return $value === null ? null : (string) $value;
    }

    /**
     * @param  list<int>  $ids
     * @return Collection<int, Product>
     */
    private function products(array $ids): Collection
    {
        return Product::query()->with(['categories:id,name', 'media'])->whereKey($ids)->orderBy('id')->get()->keyBy('id');
    }
}
