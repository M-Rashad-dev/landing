<?php

declare(strict_types=1);

namespace App\Ai\Copilot;

use App\Ai\Ai;
use App\Ai\AiWallets;
use App\Exceptions\ApiException;
use App\Jobs\CopilotReply;
use App\Models\CopilotChat;
use App\Models\CopilotMessage;
use App\Models\Media;
use App\Models\ProductImport;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * The merchant's copilot chats (docs/plans/ai-copilot.md §1.2, §3.14): one open chat per user, sending a message
 * (checked and paid for up front, answered by the CopilotReply job), and the chat as the dashboard shows it.
 */
final class CopilotChats
{
    /** Messages a chat page returns. */
    public const PAGE = 40;

    public function __construct(
        private readonly Ai $ai,
        private readonly AiWallets $wallets,
        private readonly CopilotCatalog $catalog,
    ) {}

    public function enabled(): bool
    {
        return $this->ai->blocker('copilot') === null;
    }

    public function open(User $user): CopilotChat
    {
        return CopilotChat::query()->where('user_id', $user->id)->whereNull('closed_at')->latest('id')->first()
            ?? CopilotChat::query()->create(['user_id' => $user->id]);
    }

    /** «محادثة جديدة»: closes the open chat and starts an empty one. */
    public function newChat(User $user): CopilotChat
    {
        return DB::transaction(function () use ($user): CopilotChat {
            CopilotChat::query()->where('user_id', $user->id)->whereNull('closed_at')->update(['closed_at' => now()]);

            return CopilotChat::query()->create(['user_id' => $user->id]);
        });
    }

    /**
     * Saves the merchant's message and a pending reply, then queues the reply. Refused up front (nothing saved) when
     * the chat is full, a reply is still pending, the copilot is off or the balance can't cover one round.
     *
     * @param  list<int>  $mediaIds  tenant images (checked by the request)
     * @param  array<string, mixed>  $context  the page the merchant is on
     */
    public function send(CopilotChat $chat, User $user, Tenant $tenant, string $text, array $mediaIds, array $context, ?int $importId = null): CopilotMessage
    {
        if ($chat->closed_at !== null || $chat->user_id !== $user->id) {
            throw new ApiException(422, 'copilot_chat_closed', (string) __('ai.copilot.chat_full'));
        }
        if (CopilotMessage::query()->where('chat_id', $chat->id)->count() >= CopilotChat::MAX_MESSAGES - 1) {
            throw new ApiException(422, 'copilot_chat_full', (string) __('ai.copilot.chat_full'));
        }
        if (CopilotMessage::query()->where('chat_id', $chat->id)->where('status', 'pending')->exists()) {
            throw new ApiException(422, 'ai_reply_pending', (string) __('ai.copilot.reply_pending'));
        }
        if (! $this->enabled()) {
            throw new ApiException(422, 'ai_unavailable', (string) __('ai.copilot.unavailable'));
        }
        // One round's worst case: the user's words, the images and the whole output allowance.
        $estimateParts = [['type' => 'text', 'text' => $text]];
        foreach ($mediaIds as $_) {
            $estimateParts[] = ['type' => 'image', 'url' => ''];
        }
        $this->wallets->ensureCanSpend($tenant, Ai::estimate(Ai::model('copilot'), [['role' => 'user', 'content' => $estimateParts]], (int) config('ai.copilot.max_output', 4000)));

        $context = $this->cleanContext($context, $tenant, $user);

        $attachments = array_filter(['media_ids' => $mediaIds ?: null, 'import_id' => $importId]);
        $pending = DB::transaction(function () use ($chat, $text, $attachments, $context): CopilotMessage {
            CopilotMessage::query()->create([
                'chat_id' => $chat->id,
                'role' => 'user',
                'text' => $text,
                'context' => $context !== [] ? $context : null,
                'attachments' => $attachments !== [] ? $attachments : null,
                'status' => 'done',
            ]);
            if ($chat->title === null) {
                $chat->forceFill(['title' => mb_substr(trim(preg_replace('/\s+/u', ' ', $text) ?? $text), 0, 120)])->save();
            } else {
                $chat->touch();
            }
            $pending = CopilotMessage::query()->create(['chat_id' => $chat->id, 'role' => 'assistant', 'status' => 'pending', 'progress' => (string) __('ai.copilot.progress.thinking')]);
            CopilotReply::dispatch($chat->tenant_id, $pending->id)->afterCommit();

            return $pending;
        });

        return $pending->refresh();
    }

    /**
     * Keeps only context the copilot can trust: a dashboard path, and an open record / selection of a known resource
     * whose ids belong to this store (an unknown type is dropped; a foreign id is refused).
     *
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    public function cleanContext(array $context, Tenant $tenant, User $user): array
    {
        $clean = [];
        if (isset($context['page']) && is_string($context['page']) && preg_match('#^/dashboard(/[A-Za-z0-9\-_/]*)?$#', $context['page'])) {
            $clean['page'] = mb_substr($context['page'], 0, 200);
        }
        $ctx = new CopilotContext($tenant, $user);

        $entity = $context['entity'] ?? null;
        if (is_array($entity) && isset($entity['type'], $entity['id']) && ($resource = $this->catalog->resource((string) $entity['type'], $ctx)) !== null) {
            $row = $resource->query($ctx)->whereKey((int) $entity['id'])->first();
            if ($row === null) {
                throw new ApiException(422, 'wrong_context', (string) __('ai.copilot.wrong_context'));
            }
            $clean['entity'] = ['type' => $resource->key(), 'id' => (int) $row->getKey(), 'label' => $resource->labelOf($row)];
        }

        $selection = $context['selection'] ?? null;
        if (is_array($selection) && isset($selection['type'], $selection['ids']) && is_array($selection['ids'])
            && ($resource = $this->catalog->resource((string) $selection['type'], $ctx)) !== null) {
            $ids = array_values(array_unique(array_map('intval', array_slice($selection['ids'], 0, 500))));
            $found = $resource->query($ctx)->whereKey($ids)->pluck($resource->query($ctx)->getModel()->getKeyName())->map(fn ($id) => (int) $id)->all();
            if (count($found) !== count($ids)) {
                throw new ApiException(422, 'wrong_context', (string) __('ai.copilot.wrong_context'));
            }
            if ($found !== []) {
                $clean['selection'] = ['type' => $resource->key(), 'ids' => $ids];
            }
        }

        return $clean;
    }

    /**
     * The chat for the dashboard: the newest messages (or those before $beforeId), oldest first. A reply still
     * pending after PENDING_MINUTES is marked failed here (nothing was charged for what never came back).
     *
     * @return array<string, mixed>
     */
    public function format(CopilotChat $chat, ?int $beforeId = null): array
    {
        CopilotMessage::query()->where('chat_id', $chat->id)->where('status', 'pending')
            ->where('created_at', '<', now()->subMinutes(CopilotMessage::PENDING_MINUTES))
            ->update(['status' => 'failed', 'progress' => null, 'error' => (string) __('ai.copilot.timeout')]);

        $messages = CopilotMessage::query()->where('chat_id', $chat->id)
            ->when($beforeId !== null, fn ($q) => $q->where('id', '<', $beforeId))
            ->latest('id')->limit(self::PAGE + 1)->get();
        $hasMore = $messages->count() > self::PAGE;
        $messages = $messages->take(self::PAGE)->reverse()->values();

        $mediaIds = $messages->flatMap(fn (CopilotMessage $m) => $m->mediaIds())->unique()->values()->all();
        $media = $mediaIds === [] ? collect() : Media::query()->whereIn('id', $mediaIds)->get()->keyBy('id');

        return [
            'chat' => ['id' => $chat->id, 'title' => $chat->title, 'closed' => $chat->closed_at !== null, 'created_at' => $chat->created_at?->toIso8601ZuluString()],
            'messages' => $messages->map(fn (CopilotMessage $m) => $this->message($m, $media))->all(),
            'has_more' => $hasMore,
        ];
    }

    /**
     * @param  Collection<int, Media>|null  $media
     * @return array<string, mixed>
     */
    public function message(CopilotMessage $m, $media = null): array
    {
        $media ??= $m->mediaIds() === [] ? collect() : Media::query()->whereIn('id', $m->mediaIds())->get()->keyBy('id');
        $items = [];
        foreach ($m->mediaIds() as $id) {
            $item = $media->get($id);
            if ($item instanceof Media) {
                $urls = $item->urls();
                $items[] = ['id' => $item->id, 'url' => $urls['thumb'] ?? $urls['medium'] ?? $urls['large'] ?? ''];
            }
        }

        $import = isset($m->attachments['import_id']) ? ProductImport::query()->find((int) $m->attachments['import_id'], ['id', 'file_name', 'total_rows']) : null;

        return [
            'id' => $m->id,
            'role' => $m->role,
            'text' => $m->text,
            'media' => $items,
            'sheet' => $import === null ? null : ['import_id' => $import->id, 'file_name' => $import->file_name, 'rows' => (int) $import->total_rows],
            'blocks' => $m->blocks ?? [],
            'status' => $m->status,
            'progress' => $m->status === 'pending' ? $m->progress : null,
            'error' => $m->error,
            'error_code' => $m->status === 'failed' ? ($m->trace['error_code'] ?? null) : null,
            'created_at' => $m->created_at?->toIso8601ZuluString(),
        ];
    }
}
