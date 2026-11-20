<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions;

use App\Ai\Copilot\Changes\ActionPreview;
use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Ai\Copilot\Support\FormRequestRunner;
use App\Enums\ImportStatus;
use App\Http\Requests\Dashboard\ProductImportStartRequest;
use App\Imports\Products\StartImport;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;
use App\Models\ProductImport;

/**
 * Imports a sheet the merchant attached in the chat, with the platform's own importer (its column guess, its checks,
 * its progress and failures file). The products come in as drafts (not visible) unless he asks otherwise. Not
 * reversible: once started, the import page is where it is followed.
 */
final class ProductsImport extends CopilotAction
{
    public function key(): string
    {
        return 'products.import';
    }

    public function label(): string
    {
        return 'استيراد منتجات من شيت';
    }

    public function summary(): string
    {
        return 'Import the products of an Excel / CSV sheet the merchant attached here (import_id from the CONTEXT), as drafts. update_existing: update products with the same SKU instead of skipping them.';
    }

    public function schema(): array
    {
        return ['type' => 'object', 'properties' => [
            'import_id' => ['type' => 'integer', 'description' => 'The attached sheet (see CONTEXT).'],
            'update_existing' => ['type' => 'boolean', 'description' => 'Same SKU: update it (default: skip it).'],
            'visible' => ['type' => 'boolean', 'description' => 'true only if the merchant asked to publish them right away (default drafts).'],
        ], 'required' => ['import_id']];
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
        return ['rows' => ['الصفوف', 'int'], 'columns' => ['الأعمدة اللي اتفهمت', 'text']];
    }

    public function preview(array $args, CopilotContext $ctx): ActionPreview
    {
        $import = ProductImport::query()->find((int) ($args['import_id'] ?? 0));
        if ($import === null || $import->status !== ImportStatus::Uploaded) {
            throw new CopilotToolError('No sheet waiting to be imported with that import_id: ask the merchant to attach it again.');
        }
        $mapping = (array) ($import->mapping ?? []);
        $headers = (array) ($import->headers ?? []);
        $columns = [];
        foreach ($mapping as $field => $index) {
            $names = array_map(fn ($i) => (string) ($headers[(int) $i] ?? ''), (array) $index);
            $columns[(string) __('ai.copilot.import_fields.'.$field)] = implode(' + ', array_filter($names));
        }
        $options = self::options($args);
        $missing = array_values(array_diff(['name', 'price'], array_keys($mapping)));
        $note = $missing !== [] && ! ($options['existing'] === 'update' && isset($mapping['sku'])) ? (string) __('ai.copilot.import_missing') : null;

        return new ActionPreview(
            summary: (string) __('ai.copilot.import_summary', ['file' => $import->file_name, 'rows' => (int) $import->total_rows]),
            items: [[
                'entity_type' => 'product_imports',
                'entity_id' => $import->id,
                'label' => (string) $import->file_name,
                'before' => [],
                'after' => ['rows' => (int) $import->total_rows, 'columns' => $columns],
                'status' => $note === null ? CopilotChangeItem::PENDING : CopilotChangeItem::SKIPPED_INVALID,
                'note' => $note,
            ]],
            sideEffects: [['key' => 'drafts', 'count' => (int) $import->total_rows, 'text' => (string) __($options['visible'] ? 'ai.copilot.import_visible' : 'ai.copilot.import_drafts')]],
            spec: ['import_id' => $import->id, 'options' => $options],
        );
    }

    public function apply(CopilotChangeItem $item, CopilotChangeSet $set, CopilotContext $ctx): void
    {
        $import = ProductImport::query()->findOrFail($item->entity_id);
        $options = (array) ($set->spec['options'] ?? self::options([]));
        // The import page's own checks (mapping columns, name / price present).
        /** @var ProductImportStartRequest $request */
        $request = FormRequestRunner::run(ProductImportStartRequest::class, ['mapping' => (array) ($import->mapping ?? []), 'options' => $options], $ctx->user, 'productImport', $import);
        app(StartImport::class)->handle($import, $request->mapping(), (array) $request->validated('options'));
    }

    public function card(CopilotChangeSet $set): ?array
    {
        return ['import_id' => (int) ($set->spec['import_id'] ?? 0)];
    }

    /** @return array{match: string, existing: string, visible: bool} */
    private static function options(array $args): array
    {
        return ['match' => 'sku', 'existing' => ($args['update_existing'] ?? false) ? 'update' : 'skip', 'visible' => (bool) ($args['visible'] ?? false)];
    }
}
