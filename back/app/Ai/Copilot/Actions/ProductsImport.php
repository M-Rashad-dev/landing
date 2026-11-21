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
use App\Imports\Products\ImportCheck;
use App\Imports\Products\ImportFill;
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
        return 'Import the products of an Excel / CSV sheet the merchant attached in this chat (import_id from the [sheet …] lines), as drafts. update_existing: update products with the same SKU instead of skipping them. fill: values for EMPTY cells of the sheet (e.g. rows with no price get 1500). The result lists exactly what will be created / updated / skipped / fail and why.';
    }

    public function schema(): array
    {
        return ['type' => 'object', 'properties' => [
            'import_id' => ['type' => 'integer', 'description' => 'The attached sheet (see CONTEXT).'],
            'update_existing' => ['type' => 'boolean', 'description' => 'Same SKU: update it (default: skip it).'],
            'visible' => ['type' => 'boolean', 'description' => 'true only if the merchant asked to publish them right away (default drafts).'],
            'fill' => ['type' => 'object', 'description' => 'Values for the EMPTY cells of the sheet (only when the merchant asks), EGP / units.', 'properties' => [
                'price' => ['type' => 'number'],
                'stock' => ['type' => 'integer'],
            ]],
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
        // A dry run with the importer's own rules: what comes in, and why any row won't.
        $check = app(ImportCheck::class)->run($import, $mapping, $options);
        if ($check !== null && $check['create'] + $check['update'] === 0) {
            throw new CopilotToolError(__('ai.copilot.import_nothing').': '.implode(' / ', ImportCheck::lines($check)));
        }
        $missing = array_values(array_diff(['name', 'price'], array_keys(ImportFill::mapping($mapping, $options['fill'], count($headers)))));
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
            sideEffects: [
                ['key' => 'drafts', 'count' => (int) $import->total_rows, 'text' => (string) __($options['visible'] ? 'ai.copilot.import_visible' : 'ai.copilot.import_drafts')],
                ...(ImportFill::values($options['fill']) !== [] ? [['key' => 'fill', 'count' => 0, 'text' => (string) __('ai.copilot.import_fill', ['values' => self::fillText($options['fill'])])]] : []),
                ...array_map(fn (string $line) => ['key' => 'check', 'count' => 0, 'text' => $line], $check !== null ? ImportCheck::lines($check) : [(string) __('ai.copilot.import_check.unreadable')]),
            ],
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

    /** @return array{match: string, existing: string, visible: bool, fill: array<string, string>} */
    private static function options(array $args): array
    {
        return [
            'match' => 'sku',
            'existing' => ($args['update_existing'] ?? false) ? 'update' : 'skip',
            'visible' => (bool) ($args['visible'] ?? false),
            'fill' => ImportFill::values(is_array($args['fill'] ?? null) ? $args['fill'] : []),
        ];
    }

    /** @param array<string, string> $fill */
    private static function fillText(array $fill): string
    {
        return implode('، ', array_map(fn (string $field, string $value) => __('ai.copilot.import_fields.'.$field).' '.$value, array_keys($fill), array_values($fill)));
    }
}
