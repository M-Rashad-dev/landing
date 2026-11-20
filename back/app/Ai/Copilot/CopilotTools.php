<?php

declare(strict_types=1);

namespace App\Ai\Copilot;

use App\Ai\AiUnavailable;
use App\Ai\Copilot\Support\ToolResult;
use App\Ai\Knowledge;
use App\Ai\MerchantSnapshot;
use App\Billing\Entitlements;
use App\Billing\UsageCounter;
use App\Enums\PlanLimit;
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

    public function __construct(
        private readonly CopilotCatalog $catalog,
        private readonly Knowledge $knowledge,
        private readonly MerchantSnapshot $snapshot,
        private readonly Entitlements $entitlements,
        private readonly UsageCounter $usage,
    ) {}

    /** @return list<string> the tool names usable now */
    public function names(CopilotContext $ctx): array
    {
        $names = self::CORE;
        if ($this->catalog->available($ctx) !== []) {
            $names[] = 'describe';
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
                'open_page' => $this->openPage($args, $ctx),
            };
        } catch (ValidationException $e) {
            return ToolResult::error('Validation failed.', $e->errors());
        } catch (AiUnavailable) {
            return ToolResult::error('This tool is not available right now.');
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
