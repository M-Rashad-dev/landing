<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions;

use App\Ai\Copilot\Changes\ActionPreview;
use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Ai\Copilot\Support\CopilotValidationError;
use App\Ai\Copilot\Support\FormRequestRunner;
use App\Http\Requests\Dashboard\SpecGroupRequest;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;
use App\Models\SpecGroup;
use App\Store\Specs\ProductSpecs;
use App\Store\Specs\SpecGroups;
use Illuminate\Validation\ValidationException;

/**
 * New spec groups («مجموعات المواصفات») from the copilot, e.g. «اعمل مجموعة لابتوب فيها المعالج والرامات…». Each
 * group is checked by the dashboard's request first, previewed, and made on «نفّذ» by the same service. No «تراجع»
 * (a group may be added to products right after; the merchant deletes one from its page).
 */
final class SpecGroupsCreate extends CopilotAction
{
    public const MAX = 20;

    public function key(): string
    {
        return 'spec_groups.create';
    }

    public function label(): string
    {
        return 'إنشاء مجموعات مواصفات';
    }

    public function summary(): string
    {
        return 'Create up to 20 spec groups: {"groups": [{"name": "لابتوب", "rows": [{"label": "المعالج", "in_card": true, "filterable": true}, {"label": "الرامات"}]}]}. ≤ 40 rows, ≤ 4 in_card per group, labels ≤ 60. Then the merchant adds a group to products from its page (or ask products.fill_specs to fill values later).';
    }

    public function available(CopilotContext $ctx): bool
    {
        return $ctx->hasStore();
    }

    public function schema(): array
    {
        return ['type' => 'object', 'properties' => [
            'groups' => ['type' => 'array', 'maxItems' => self::MAX, 'items' => ['type' => 'object', 'properties' => [
                'name' => ['type' => 'string'],
                'rows' => ['type' => 'array', 'items' => ['type' => 'object', 'properties' => [
                    'label' => ['type' => 'string'],
                    'in_card' => ['type' => 'boolean'],
                    'filterable' => ['type' => 'boolean'],
                ], 'required' => ['label']]],
            ], 'required' => ['name', 'rows']]],
        ], 'required' => ['groups']];
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
        return ['name' => ['الاسم', 'text'], 'rows' => [(string) __('ai.copilot.spec_groups_column_rows'), 'text']];
    }

    public function preview(array $args, CopilotContext $ctx): ActionPreview
    {
        $groups = array_values(array_filter((array) ($args['groups'] ?? []), 'is_array'));
        if ($groups === [] || count($groups) > self::MAX) {
            throw new CopilotToolError('groups must list 1 to '.self::MAX.' groups.');
        }
        if (SpecGroup::query()->count() + count($groups) > SpecGroups::max()) {
            throw new CopilotToolError('A store keeps at most '.SpecGroups::max().' spec groups.');
        }
        $names = [];
        $errors = [];
        $clean = [];
        foreach ($groups as $i => $group) {
            try {
                $request = FormRequestRunner::run(SpecGroupRequest::class, $group, $ctx->user);
                $data = $request->validated();
                $key = ProductSpecs::key((string) $data['name']);
                if (isset($names[$key])) {
                    $errors["groups.{$i}.name"] = ['Two groups with the same name.'];

                    continue;
                }
                $names[$key] = true;
                $clean[] = $data;
            } catch (ValidationException $e) {
                $errors["groups.{$i}"] = FormRequestRunner::errors($e);
            }
        }
        if ($errors !== []) {
            throw new CopilotValidationError('Nothing was proposed: fix these groups and send them all again.', $errors);
        }

        return new ActionPreview(
            summary: (string) __('ai.copilot.spec_groups_create_summary', ['count' => count($clean)]),
            items: array_map(fn (array $g) => [
                'entity_type' => 'spec_groups',
                'entity_id' => null,
                'label' => (string) $g['name'],
                'before' => [],
                'after' => ['name' => (string) $g['name'], 'rows' => implode('، ', array_map(fn ($r) => (string) $r['label'], $g['rows']))],
            ], $clean),
            spec: ['groups' => $clean],
        );
    }

    public function apply(CopilotChangeItem $item, CopilotChangeSet $set, CopilotContext $ctx): void
    {
        $name = ProductSpecs::key((string) (((array) $item->after)['name'] ?? ''));
        $data = collect((array) ($set->spec['groups'] ?? []))->first(fn ($g) => is_array($g) && ProductSpecs::key((string) ($g['name'] ?? '')) === $name) ?? [];
        // Checked again: a group of that name may have been made since the preview.
        $request = FormRequestRunner::run(SpecGroupRequest::class, $data, $ctx->user);
        app(SpecGroups::class)->create($request->validated());
    }
}
