<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions;

use App\Ai\Copilot\Changes\ActionPreview;
use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Billing\Entitlements;
use App\Enums\PlanFeature;
use App\Models\AbandonedLead;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;
use App\Recovery\CartRecovery;

/**
 * «ابعت تذكير» now to abandoned leads (every one it can reach, or the given ids): WhatsApp from the store's message
 * balance and email when known, no coupon, any hour. It counts as the lead's next reminder step.
 */
final class CartRecoveryRemind extends CopilotAction
{
    private const MAX = 200;

    public function __construct(private readonly CartRecovery $recovery, private readonly Entitlements $entitlements) {}

    public function key(): string
    {
        return 'cart_recovery.remind';
    }

    public function label(): string
    {
        return 'إرسال تذكير للسلات المتروكة';
    }

    public function summary(): string
    {
        return 'Send a cart reminder now (WhatsApp from the message balance + email when known, no coupon) to open/contacted abandoned leads with a phone, up to 14 days old, not waiting on an order payment. ids: specific leads (from abandoned_leads); omit for all of them (max 200 per card).';
    }

    public function available(CopilotContext $ctx): bool
    {
        return $this->entitlements->allows(PlanFeature::AbandonedLeads);
    }

    public function schema(): array
    {
        return ['type' => 'object', 'properties' => [
            'ids' => ['type' => 'array', 'items' => ['type' => 'integer'], 'maxItems' => self::MAX, 'description' => 'Lead ids; omit = every lead it can reach.'],
        ]];
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
        return ['customer' => ['العميل', 'text'], 'reminders' => ['تذكيرات اتبعتت', 'int']];
    }

    public function preview(array $args, CopilotContext $ctx): ActionPreview
    {
        $ids = isset($args['ids']) && is_array($args['ids']) && $args['ids'] !== [] ? array_values(array_map('intval', $args['ids'])) : null;
        $leads = $this->recovery->manualTargets($ids)->orderBy('id')->limit(self::MAX)->get();
        if ($leads->isEmpty()) {
            throw new CopilotToolError('No lead can get a reminder: it needs a phone, at most 14 days old, open or contacted, and not waiting on an order payment.');
        }

        return new ActionPreview(
            summary: (string) __('ai.copilot.remind_summary', ['count' => $leads->count()]),
            items: $leads->map(fn (AbandonedLead $lead): array => [
                'entity_type' => 'abandoned_leads',
                'entity_id' => $lead->id,
                'label' => $lead->customer_name ?: (string) $lead->customer_phone,
                'before' => ['reminders' => $lead->reminders_sent],
                'after' => ['customer' => (string) $lead->customer_phone, 'reminders' => $lead->reminders_sent + 1],
                'status' => CopilotChangeItem::PENDING,
                'note' => null,
            ])->values()->all(),
            sideEffects: [['key' => 'messages', 'count' => $leads->count(), 'text' => (string) __('ai.copilot.remind_side_effect', ['count' => $leads->count()])]],
            spec: [],
        );
    }

    public function current(CopilotChangeItem $item, CopilotContext $ctx): ?array
    {
        $lead = AbandonedLead::query()->find($item->entity_id);

        return $lead === null ? null : ['reminders' => $lead->reminders_sent];
    }

    public function apply(CopilotChangeItem $item, CopilotChangeSet $set, CopilotContext $ctx): void
    {
        $lead = $this->recovery->manualTargets([(int) $item->entity_id])->first();
        if ($lead === null || ! $this->recovery->remindNow($lead)) {
            throw new CopilotToolError((string) __('ai.copilot.remind_failed'));
        }
    }
}
