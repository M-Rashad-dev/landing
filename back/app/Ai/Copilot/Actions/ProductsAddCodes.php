<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions;

use App\Ai\Copilot\Changes\ActionPreview;
use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Enums\DeliveryType;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;
use App\Models\Product;
use App\Store\Digital\DigitalCodes;
use Illuminate\Support\Facades\Crypt;

/**
 * Adds entries to a codes product (the merchant pasted them or attached a sheet). The codes are kept encrypted in
 * the change and never shown back: the preview counts them.
 */
final class ProductsAddCodes extends CopilotAction
{
    private const MAX = 500;

    public function __construct(private readonly DigitalCodes $codes) {}

    public function key(): string
    {
        return 'products.add_codes';
    }

    public function label(): string
    {
        return 'إضافة أكواد لمنتج رقمي';
    }

    public function summary(): string
    {
        return 'Add entries to a digital product delivered as codes (one entry per item of codes: a code, or a multi-line email + password). uses = how many buyers each entry can go to (default 1). option = the option value(s) for products with options, e.g. "325 UC". Never repeat the codes back to the merchant.';
    }

    public function available(CopilotContext $ctx): bool
    {
        return Product::query()->where('delivery_type', DeliveryType::Codes->value)->exists();
    }

    public function schema(): array
    {
        return ['type' => 'object', 'properties' => [
            'product_id' => ['type' => 'integer'],
            'codes' => ['type' => 'array', 'items' => ['type' => 'string'], 'maxItems' => self::MAX],
            'uses' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 1000],
            'option' => ['type' => 'string', 'description' => 'The combination label, like "325 UC" or "أحمر / XL". Empty without options.'],
        ], 'required' => ['product_id', 'codes']];
    }

    public function approval(): bool
    {
        return true;
    }

    public function reversible(): bool
    {
        return false;
    }

    public function columns(): array
    {
        return ['codes' => ['الأكواد', 'int'], 'option' => ['الاختيار', 'text']];
    }

    public function preview(array $args, CopilotContext $ctx): ActionPreview
    {
        $product = Product::query()->find((int) ($args['product_id'] ?? 0));
        if ($product === null || ! $product->deliversCodes()) {
            throw new CopilotToolError('product_id must be a digital product delivered as codes.');
        }
        $codes = array_values(array_filter(array_map(fn ($c) => is_string($c) ? trim($c) : '', (array) ($args['codes'] ?? [])), fn (string $c) => $c !== '' && mb_strlen($c) <= 2000));
        if ($codes === [] || count($codes) > self::MAX) {
            throw new CopilotToolError('Send 1 to '.self::MAX.' codes.');
        }
        $label = trim((string) ($args['option'] ?? ''));
        $combos = $this->codes->combinations($product);
        $combo = collect($combos)->first(fn (array $c) => mb_strtolower($c['label']) === mb_strtolower($label));
        if ($combo === null) {
            throw new CopilotToolError('option must be one of: '.implode(', ', array_map(fn ($c) => '"'.$c['label'].'"', $combos)).'.');
        }

        return new ActionPreview(
            summary: (string) __('ai.copilot.codes_summary', ['count' => count($codes), 'product' => $product->name]),
            items: [[
                'entity_type' => 'products',
                'entity_id' => $product->id,
                'label' => $product->name,
                'before' => [],
                'after' => ['codes' => count($codes), 'option' => $combo['label']],
                'status' => CopilotChangeItem::PENDING,
                'note' => null,
            ]],
            sideEffects: [],
            spec: ['key' => $combo['key'], 'uses' => max(1, min(1000, (int) ($args['uses'] ?? 1))), 'codes' => Crypt::encryptString((string) json_encode($codes))],
        );
    }

    public function apply(CopilotChangeItem $item, CopilotChangeSet $set, CopilotContext $ctx): void
    {
        $product = Product::query()->findOrFail($item->entity_id);
        $codes = json_decode(Crypt::decryptString((string) $set->spec['codes']), true);
        $uses = (int) ($set->spec['uses'] ?? 1);
        $this->codes->add($product, (string) $set->spec['key'], array_map(fn (string $c) => ['code' => $c, 'uses' => $uses], is_array($codes) ? $codes : []));
    }
}
