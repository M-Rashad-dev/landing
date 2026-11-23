<?php

declare(strict_types=1);

namespace App\Ai\Copilot;

use App\Ai\AiUnavailable;
use App\Ai\Copilot\Changes\ChangeSetPresenter;
use App\Ai\Copilot\Changes\ChangeSetProposer;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Ai\Copilot\Support\CopilotValidationError;
use App\Ai\Copilot\Support\ExportBuilder;
use App\Ai\Copilot\Support\RecordQuery;
use App\Ai\Copilot\Support\ToolResult;
use App\Ai\Knowledge;
use App\Ai\MerchantSnapshot;
use App\Billing\Entitlements;
use App\Billing\UsageCounter;
use App\Enums\PlanLimit;
use App\Exceptions\ApiException;
use App\Models\LandingPage;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * The tools the model gets (docs/plans/ai-copilot.md §3.4). Their number is fixed: a new platform feature adds a
 * line to the catalog, never a tool. A tool is offered only when this store has something for it (no resource →
 * no find_records), so the model never wastes a round on a tool that can't help.
 *
 * There is no tool to approve, publish, reject or revert: only the merchant's buttons do that.
 */
final class CopilotTools
{
    /** Tools that always exist. */
    private const CORE = ['help_search', 'store_overview', 'open_page'];

    /** Rows a table card shows (the rest is in the file). */
    public const TABLE_ROWS = 200;

    public function __construct(
        private readonly CopilotCatalog $catalog,
        private readonly Knowledge $knowledge,
        private readonly MerchantSnapshot $snapshot,
        private readonly Entitlements $entitlements,
        private readonly UsageCounter $usage,
        private readonly ExportBuilder $exports,
        private readonly ChangeSetProposer $proposer,
        private readonly ChangeSetPresenter $presenter,
    ) {}

    /** @return list<string> the tool names usable now */
    public function names(CopilotContext $ctx): array
    {
        $names = self::CORE;
        if ($this->catalog->available($ctx) !== []) {
            $names[] = 'describe';
        }
        if ($this->catalog->resources($ctx) !== []) {
            $names[] = 'find_records';
        }
        if ($this->catalog->reports($ctx) !== []) {
            $names[] = 'run_report';
        }
        if ($this->catalog->resources($ctx) !== [] || $this->catalog->reports($ctx) !== []) {
            $names[] = 'export_xlsx';
        }
        $resources = $this->catalog->resources($ctx);
        if (array_filter($resources, fn ($r) => $r->creatable()) !== []) {
            $names[] = 'create_records';
        }
        if (array_filter($resources, fn ($r) => $r->writable()) !== []) {
            $names[] = 'update_records';
        }
        if ($this->catalog->actions($ctx) !== []) {
            $names[] = 'run_action';
        }

        return $names;
    }

    /** @return list<array<string, mixed>> OpenAI function definitions */
    public function definitions(CopilotContext $ctx): array
    {
        $all = [
            'help_search' => ['Search the Mksab help articles (how the platform works, where things are, step-by-step guides). Use it for any «how do I…» question before answering.', [
                'query' => ['type' => 'string', 'description' => 'The question in the merchant\'s words (Arabic is fine).'],
            ], ['query']],
            'store_overview' => ['The store at a glance: plan, plan limits used / left, domains, product and order counts, landing pages. Use it before advising on limits or the plan.', [], []],
            'describe' => ['Full detail of one catalog entry (fields, filters, change ops, params or args). Call it before the first use of a resource, report or action in this chat.', [
                'name' => ['type' => 'string', 'description' => 'The catalog key, e.g. "products" or "orders.change_status".'],
            ], ['name']],
            'find_records' => ['Find records of a catalog resource (products, orders, customers…). Returns the total count and up to `limit` rows for you (personal data left out). Set show=true to also show the merchant a table of the rows (with a download button). For totals and sums use a report, not this.', [
                'resource' => ['type' => 'string', 'description' => 'Catalog resource key.'],
                'filters' => ['type' => 'object', 'description' => 'Field filters {field: value} or {field: {op: value}} (ops by type: eq, ne, in, gt, gte, lt, lte, between [a,b], contains, empty, not_empty; dates YYYY-MM-DD or {period: last_7_days…}), the resource\'s named filters, and q for text search. See describe.'],
                'sort' => ['type' => 'string', 'description' => 'A sortable field («price», «-price» for descending) or a named sort.'],
                'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50, 'description' => 'Rows for you (default 20).'],
                'show' => ['type' => 'boolean', 'description' => 'Show the merchant a table of the results (up to 200 rows).'],
            ], ['resource']],
            'run_report' => ['Run a catalog report (sales, best sellers, low stock…): exact numbers computed by the server, the same as the dashboard pages. Set show=true to show the merchant its table too.', [
                'report' => ['type' => 'string', 'description' => 'Catalog report key.'],
                'params' => ['type' => 'object', 'description' => 'The report\'s params (see describe); periods are presets like last_7_days or from / to dates.'],
                'show' => ['type' => 'boolean', 'description' => 'Show the merchant the report table.'],
            ], ['report']],
            'export_xlsx' => ['Build an Excel file for the merchant to download (built on the server with all rows and every column, up to 20,000 rows). You only get the row count back.', [
                'resource' => ['type' => 'string', 'description' => 'A resource to export (with filters / sort like find_records)…'],
                'filters' => ['type' => 'object'],
                'sort' => ['type' => 'string'],
                'report' => ['type' => 'string', 'description' => '…or a report to export (with params).'],
                'params' => ['type' => 'object'],
                'filename' => ['type' => 'string', 'description' => 'Short Arabic file name (optional).'],
            ], []],
            'create_records' => ['Create new records (products, categories…) AT ONCE AS DRAFTS: not visible to customers until the merchant presses «انشر» on the card. Up to 50 per call; all are validated first and none is created if one is invalid. See describe for create_fields.', [
                'resource' => ['type' => 'string'],
                'items' => ['type' => 'array', 'items' => ['type' => 'object'], 'description' => 'One object of fields per record.'],
                'keep_draft' => ['type' => 'boolean', 'description' => 'true when the merchant asked to keep them as drafts (the card then confirms instead of publishing).'],
            ], ['resource', 'items']],
            'update_records' => ['Prepare a change to existing records as a PROPOSAL: the server computes every new value and shows the merchant a before → after preview card; nothing changes until he presses «نفّذ». Send operations, never computed values (e.g. price {"percent": 30, "round": {"to": 5, "mode": "nearest"}}).', [
                'resource' => ['type' => 'string'],
                'selector' => ['type' => 'object', 'description' => '{"ids": [...]} or {"filters": {...}} (like find_records; {} = all) or {"context": "entity" | "selection"} for what the merchant has open / selected.'],
                'changes' => ['type' => 'object', 'description' => '{field: op}. Ops by type — money: set | add | percent (+ optional round {to: 1|5|10|50|100, mode: nearest|up|down}) | clear; int: set | add; bool / enum: set; text: set | replace {find, with} | prepend | append; ids: add | remove | set.'],
            ], ['resource', 'selector', 'changes']],
            'run_action' => ['Run a catalog action (see describe for its args). Safe checks run at once; anything that changes the store becomes a card the merchant approves; AI / image work first shows its estimated cost and starts only on «ابدأ».', [
                'action' => ['type' => 'string', 'description' => 'Catalog action key, e.g. "products.write_content".'],
                'args' => ['type' => 'object'],
            ], ['action']],
            'open_page' => ['Give the merchant a button to a page: the AI designer (to design sections or pages), or a dashboard page. Use it for design requests and for anything you can\'t do here (payments, account, password, domain make-primary / delete).', [
                'target' => ['type' => 'string', 'enum' => ['designer', 'page'], 'description' => 'designer = the AI designer in the Builder; page = a dashboard page.'],
                'resource' => ['type' => 'string', 'description' => 'page: a catalog resource key whose page to open.'],
                'path' => ['type' => 'string', 'description' => 'page: a dashboard path starting with /dashboard (when no resource fits).'],
                'landing_page_id' => ['type' => 'integer', 'description' => 'designer: the landing page to design (omit for the store).'],
                'prompt' => ['type' => 'string', 'description' => 'designer: the merchant\'s design request, to fill in the designer chat.'],
                'label' => ['type' => 'string', 'description' => 'Short Arabic button text (optional).'],
            ], ['target']],
        ];

        $defs = [];
        foreach ($this->names($ctx) as $name) {
            [$description, $properties, $required] = $all[$name];
            $defs[] = ['type' => 'function', 'function' => [
                'name' => $name,
                'description' => $description,
                'parameters' => ['type' => 'object', 'properties' => (object) $properties, 'required' => $required],
            ]];
        }

        return $defs;
    }

    /**
     * Runs one tool call. Mistakes (unknown tool, bad arguments, validation, limits) come back as an error result the
     * model can fix; only real crashes are reported.
     *
     * @param  array<string, mixed>  $args
     */
    public function run(string $name, array $args, CopilotContext $ctx): ToolResult
    {
        if (! in_array($name, $this->names($ctx), true)) {
            return ToolResult::error("Unknown or unavailable tool «{$name}». Available: ".implode(', ', $this->names($ctx)).'.');
        }
        $ctx->progress((string) __('ai.copilot.progress.'.(trans()->has('ai.copilot.progress.'.$name) ? $name : 'tool')));

        try {
            return match ($name) {
                'help_search' => $this->helpSearch($args, $ctx),
                'store_overview' => $this->storeOverview($ctx),
                'describe' => $this->describe($args, $ctx),
                'find_records' => $this->findRecords($args, $ctx),
                'run_report' => $this->runReport($args, $ctx),
                'export_xlsx' => $this->exportXlsx($args, $ctx),
                'create_records' => $this->createRecords($args, $ctx),
                'update_records' => $this->updateRecords($args, $ctx),
                'run_action' => $this->runAction($args, $ctx),
                'open_page' => $this->openPage($args, $ctx),
            };
        } catch (CopilotValidationError $e) {
            return ToolResult::error($e->getMessage(), $e->fields);
        } catch (CopilotToolError $e) {
            return ToolResult::error($e->getMessage());
        } catch (ApiException $e) {
            // A plan limit, a feature the plan lacks…: the message is for the merchant.
            return ToolResult::error($e->getMessage());
        } catch (ValidationException $e) {
            return ToolResult::error('Validation failed.', $e->errors());
        } catch (AiUnavailable $e) {
            return ToolResult::error('This tool is not available right now. Tell the merchant exactly this reason: '.$e->reasonText());
        } catch (Throwable $e) {
            report($e);

            return ToolResult::error('The tool failed. Tell the merchant simply and suggest trying again.');
        }
    }

    /** @param array<string, mixed> $args */
    private function helpSearch(array $args, CopilotContext $ctx): ToolResult
    {
        $query = trim(mb_substr((string) ($args['query'] ?? ''), 0, 500));
        if ($query === '') {
            return ToolResult::error('query is required.');
        }
        $pieces = $this->knowledge->search($query, $ctx->tenant->id, 'copilot');

        return ToolResult::ok([
            'articles' => array_map(fn (array $p) => ['id' => $p['article_id'], 'title' => $p['title'], 'text' => mb_substr($p['text'], 0, 1500)], $pieces),
            'note' => $pieces === [] ? 'Nothing matched: answer from what you know of the catalog, or say you are not sure.' : null,
        ]);
    }

    private function storeOverview(CopilotContext $ctx): ToolResult
    {
        $plan = $this->entitlements->for($ctx->tenant);
        $limits = [];
        foreach (PlanLimit::cases() as $limit) {
            $used = $this->usage->used($limit);
            $limits[] = ['key' => $limit->value, 'label' => $limit->label(), 'used' => $used, 'limit' => $plan->isUnlimited($limit) ? null : $plan->limit($limit)];
        }

        return ToolResult::ok([
            'overview' => $this->snapshot->text($ctx->tenant),
            'has_store' => $ctx->hasStore(),
            'limits' => $limits,
            'note' => 'limit null = unlimited on this plan.',
        ]);
    }

    /** @param array<string, mixed> $args */
    private function describe(array $args, CopilotContext $ctx): ToolResult
    {
        $name = (string) ($args['name'] ?? '');
        $item = $this->catalog->find($name, $ctx);
        if ($item === null) {
            return ToolResult::error("No catalog entry «{$name}». Known: ".implode(', ', array_keys($this->catalog->available($ctx))).'.');
        }

        return ToolResult::ok($item->describe($ctx));
    }

    /** @param array<string, mixed> $args */
    private function findRecords(array $args, CopilotContext $ctx): ToolResult
    {
        $resource = $this->catalog->resource((string) ($args['resource'] ?? ''), $ctx);
        if ($resource === null) {
            return ToolResult::error('Unknown resource. Known: '.implode(', ', array_keys($this->catalog->resources($ctx))).'.');
        }
        $filters = is_array($args['filters'] ?? null) ? $args['filters'] : [];
        $sort = isset($args['sort']) && is_string($args['sort']) ? $args['sort'] : null;
        $limit = max(1, min(50, (int) ($args['limit'] ?? 20)));
        $query = RecordQuery::build($resource, $filters, $sort, $ctx)->with($resource->with());
        $total = (clone $query)->toBase()->getCountForPagination();
        $show = (bool) ($args['show'] ?? false);
        $rows = (clone $query)->limit($show ? self::TABLE_ROWS : $limit)->get();

        if ($show && $total > 0) {
            $ctx->addBlock([
                'type' => 'table',
                'title' => $resource->label(),
                'columns' => $resource->columns(),
                'rows' => $rows->map(fn ($row) => $resource->tableRow($row))->all(),
                'total' => $total,
                'export' => ['resource' => $resource->key(), 'filters' => $filters, 'sort' => $sort],
                'link' => $resource->url(null),
            ]);
        }

        return ToolResult::ok([
            'resource' => $resource->key(),
            'total' => $total,
            'rows' => $rows->take($limit)->map(fn ($row) => $resource->present($row, true))->values()->all(),
            'shown_to_merchant' => $show && $total > 0,
            'note' => $total > $limit ? "Only the first {$limit} of {$total} rows are here; for totals use a report, for all rows export_xlsx." : null,
        ]);
    }

    /** @param array<string, mixed> $args */
    private function runReport(array $args, CopilotContext $ctx): ToolResult
    {
        $report = $this->catalog->report((string) ($args['report'] ?? ''), $ctx);
        if ($report === null) {
            return ToolResult::error('Unknown report. Known: '.implode(', ', array_keys($this->catalog->reports($ctx))).'.');
        }
        $params = is_array($args['params'] ?? null) ? $args['params'] : [];
        $result = $report->run($params, $ctx);
        $show = (bool) ($args['show'] ?? false) && $result->hasTable() && $result->rows !== [];
        if ($show) {
            $ctx->addBlock([
                'type' => 'table',
                'title' => $result->title !== '' ? $result->title : $report->label(),
                'columns' => $result->columns,
                'rows' => array_slice($result->rows, 0, self::TABLE_ROWS),
                'total' => count($result->rows),
                'export' => ['report' => $report->key(), 'params' => $params],
            ]);
        }

        return ToolResult::ok(['report' => $report->key(), 'result' => $result->summary, 'shown_to_merchant' => $show]);
    }

    /** @param array<string, mixed> $args */
    private function exportXlsx(array $args, CopilotContext $ctx): ToolResult
    {
        $source = isset($args['resource'])
            ? ['resource' => (string) $args['resource'], 'filters' => is_array($args['filters'] ?? null) ? $args['filters'] : [], 'sort' => isset($args['sort']) && is_string($args['sort']) ? $args['sort'] : null]
            : ['report' => (string) ($args['report'] ?? ''), 'params' => is_array($args['params'] ?? null) ? $args['params'] : []];
        $ctx->progress((string) __('ai.copilot.progress.export_xlsx'));
        $export = $this->exports->build($source, isset($args['filename']) && is_string($args['filename']) ? $args['filename'] : null, $ctx);
        $ctx->addBlock(ExportBuilder::block($export));

        return ToolResult::ok(['file' => $export->filename, 'rows' => $export->rows_count, 'shown' => 'A download button is shown under your reply (the file is kept 24 hours).']);
    }

    /** @param array<string, mixed> $args */
    private function createRecords(array $args, CopilotContext $ctx): ToolResult
    {
        $resource = $this->catalog->resource((string) ($args['resource'] ?? ''), $ctx);
        if ($resource !== null && ! CopilotCatalog::permits($resource->key(), $ctx, 1)) {
            return ToolResult::error('This person may not create '.$resource->key().' (no permission). Tell him to ask the store owner.');
        }
        if ($resource === null || ! $resource->creatable()) {
            return ToolResult::error('Records can be created for: '.implode(', ', array_keys(array_filter($this->catalog->resources($ctx), fn ($r) => $r->creatable()))).'.');
        }
        $set = $this->proposer->create($resource, is_array($args['items'] ?? null) ? array_values($args['items']) : [], (bool) ($args['keep_draft'] ?? false), $ctx);

        return ToolResult::ok($this->presenter->forModel($set));
    }

    /** @param array<string, mixed> $args */
    private function updateRecords(array $args, CopilotContext $ctx): ToolResult
    {
        $resource = $this->catalog->resource((string) ($args['resource'] ?? ''), $ctx);
        if ($resource !== null && ! CopilotCatalog::permits($resource->key(), $ctx, 2)) {
            return ToolResult::error('This person may not change '.$resource->key().' (no permission). Tell him to ask the store owner.');
        }
        if ($resource === null || ! $resource->writable()) {
            return ToolResult::error('Records can be changed for: '.implode(', ', array_keys(array_filter($this->catalog->resources($ctx), fn ($r) => $r->writable()))).'.');
        }
        $proposal = $this->proposer->update($resource, is_array($args['selector'] ?? null) ? $args['selector'] : [], is_array($args['changes'] ?? null) ? $args['changes'] : [], $ctx);

        return ToolResult::ok($this->presenter->forModel($proposal['set'], $proposal['unchanged']));
    }

    /** @param array<string, mixed> $args */
    private function runAction(array $args, CopilotContext $ctx): ToolResult
    {
        $action = $this->catalog->action((string) ($args['action'] ?? ''), $ctx);
        if ($action === null) {
            return ToolResult::error('Unknown action. Known: '.implode(', ', array_keys($this->catalog->actions($ctx))).'.');
        }
        $actionArgs = is_array($args['args'] ?? null) ? $args['args'] : [];
        if (! $action->approval()) {
            return $action->run($actionArgs, $ctx);
        }

        return ToolResult::ok($this->presenter->forModel($this->proposer->action($action, $actionArgs, $ctx)));
    }

    /** @param array<string, mixed> $args */
    private function openPage(array $args, CopilotContext $ctx): ToolResult
    {
        $target = (string) ($args['target'] ?? '');
        $label = trim(mb_substr((string) ($args['label'] ?? ''), 0, 40));
        $prompt = trim(mb_substr((string) ($args['prompt'] ?? ''), 0, 1000));

        if ($target === 'designer') {
            $pageId = isset($args['landing_page_id']) ? (int) $args['landing_page_id'] : null;
            if ($pageId !== null) {
                $page = LandingPage::query()->landings()->find($pageId);
                if ($page === null) {
                    return ToolResult::error('No such landing page in this store.');
                }
                $href = "/dashboard/landings/{$page->id}/builder";
            } elseif ($ctx->hasStore()) {
                $href = '/dashboard/design/builder';
            } else {
                return ToolResult::error('This store has landing pages only: ask which landing page to design (landing_page_id).');
            }
            $href .= '?'.http_build_query(array_filter(['ai' => 1, 'prompt' => $prompt]));
            $ctx->addBlock(['type' => 'handoff', 'target' => 'designer', 'label' => $label !== '' ? $label : (string) __('ai.copilot.open_designer'), 'href' => $href]);

            return ToolResult::ok(['shown' => 'A button to the AI designer is shown under your reply; the request is filled in there.']);
        }

        if ($target === 'page') {
            $href = null;
            if (isset($args['resource'])) {
                $href = $this->catalog->resource((string) $args['resource'], $ctx)?->url(null);
            } elseif (isset($args['path']) && preg_match('#^/dashboard(/[a-z0-9\-]+)*$#', (string) $args['path'])) {
                $href = (string) $args['path'];
            }
            if ($href === null) {
                return ToolResult::error('Give a known resource key, or a path like /dashboard/settings.');
            }
            $ctx->addBlock(['type' => 'handoff', 'target' => 'page', 'label' => $label !== '' ? $label : (string) __('ai.copilot.open_page'), 'href' => $href]);

            return ToolResult::ok(['shown' => 'A button to the page is shown under your reply.']);
        }

        return ToolResult::error('target must be designer or page.');
    }
}
