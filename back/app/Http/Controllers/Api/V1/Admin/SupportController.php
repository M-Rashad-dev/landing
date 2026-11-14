<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\SupportStatus;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\SupportMessageRequest;
use App\Models\SupportAttachment;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Services\Support\SupportDesk;
use App\Services\Support\SupportFiles;
use App\Services\Support\SupportPresenter;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * The platform's support inbox: every store's conversations, answer, close, reopen on request,
 * and the performance numbers (first reply, resolution, ratings).
 *
 * Audited bypass: the super admin has no tenant, so tickets are found across stores here; every
 * change is then made inside the ticket's own store (Tenancy::runAs).
 */
final class SupportController extends Controller
{
    use RespondsWithJson;

    private const TABS = ['waiting_support', 'waiting_merchant', 'closed', 'all'];

    private const PAGE = 50;

    public function __construct(private readonly SupportDesk $desk, private readonly SupportPresenter $presenter) {}

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => ['nullable', 'string', 'in:'.implode(',', self::TABS)],
            'q' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $tab = $data['status'] ?? 'waiting_support';
        $q = trim((string) ($data['q'] ?? ''));

        return Tenancy::withoutTenant(function () use ($tab, $q): JsonResponse {
            $search = fn ($query) => $query->when($q !== '', fn ($w) => $w->where(fn ($s) => $s
                ->where('number', ltrim($q, '#'))
                ->orWhereHas('tenant', fn ($t) => $t->where('name', 'like', '%'.addcslashes($q, '%_\\').'%'))));

            $page = $search(SupportTicket::query())
                ->with('tenant:id,name')->withMax('messages', 'id')
                ->when($tab !== 'all', fn ($w) => $w->where('status', $tab))
                ->orderBy($tab === 'waiting_support' ? 'last_merchant_message_at' : 'last_message_at', $tab === 'waiting_support' ? 'asc' : 'desc')
                ->paginate(30);

            $counts = [];
            foreach (SupportStatus::cases() as $status) {
                $counts[$status->value] = SupportTicket::query()->where('status', $status->value)->count();
            }
            $counts['all'] = array_sum($counts);

            return $this->ok($this->rows($page->items()), [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'counts' => $counts,
            ]);
        });
    }

    /** Conversations with a merchant message support has not read (sidebar badge). */
    public function unread(): JsonResponse
    {
        $count = Tenancy::withoutTenant(fn () => SupportTicket::query()->where('status', SupportStatus::WaitingSupport->value)
            ->where(fn ($q) => $q->whereNull('support_read_at')->orWhereColumn('support_read_at', '<', 'last_merchant_message_at'))
            ->count());

        return $this->ok(['unread' => $count]);
    }

    public function show(Request $request, int $number): JsonResponse
    {
        $ticket = $this->find($number);
        $before = $request->integer('before') ?: null;

        return $this->ok(Tenancy::runAs($ticket->tenant_id, fn () => $this->conversation($ticket, $before)));
    }

    public function message(SupportMessageRequest $request, int $number): JsonResponse
    {
        $ticket = $this->find($number);
        $message = Tenancy::runAs($ticket->tenant_id, fn () => $this->desk->reply($ticket, SupportMessage::SUPPORT, (int) $request->user()?->getAuthIdentifier(), $request->body(), $request->uploads()));

        return $this->created($this->presenter->message($message));
    }

    public function read(int $number): JsonResponse
    {
        $ticket = $this->find($number);
        Tenancy::runAs($ticket->tenant_id, fn () => $this->desk->read($ticket, SupportMessage::SUPPORT));

        return $this->ok($this->presenter->ticket($ticket));
    }

    public function close(Request $request, int $number): JsonResponse
    {
        $ticket = $this->find($number);
        Tenancy::runAs($ticket->tenant_id, fn () => $this->desk->close($ticket, 'support', (int) $request->user()?->getAuthIdentifier()));

        return $this->ok($this->presenter->ticket($ticket->refresh()));
    }

    /** Opens a closed conversation again when the merchant asks (e.g. a fix that took days). */
    public function reopen(int $number): JsonResponse
    {
        $ticket = $this->find($number);
        Tenancy::runAs($ticket->tenant_id, fn () => $this->desk->reopen($ticket));

        return $this->ok($this->presenter->ticket($ticket->refresh()));
    }

    public function attachment(int $id, SupportFiles $files): BinaryFileResponse
    {
        $attachment = Tenancy::withoutTenant(fn () => SupportAttachment::query()->findOrFail($id));

        return response()->file($files->absolutePath($attachment), [
            'Content-Type' => $attachment->mime,
            'Cache-Control' => 'private, max-age=86400',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /** Support performance over a period (default: the last 30 days). */
    public function stats(Request $request): JsonResponse
    {
        $data = $request->validate(['days' => ['nullable', 'integer', 'in:7,30,90,365']]);
        $days = (int) ($data['days'] ?? 30);
        $from = now()->subDays($days);

        return Tenancy::withoutTenant(function () use ($from, $days): JsonResponse {
            $tickets = SupportTicket::query()->with('tenant:id,name')->where('created_at', '>=', $from)->get();
            $minutes = fn (?Carbon $a, ?Carbon $b): ?float => $a !== null && $b !== null ? $a->diffInSeconds($b) / 60 : null;
            $avg = fn (array $values): ?float => $values === [] ? null : round(array_sum($values) / count($values), 1);
            $firstReplies = array_values(array_filter($tickets->map(fn (SupportTicket $t) => $minutes($t->created_at, $t->first_response_at))->all(), fn ($v) => $v !== null));
            $resolutions = array_values(array_filter($tickets->where('status', SupportStatus::Closed)->map(fn (SupportTicket $t) => $minutes($t->created_at, $t->closed_at))->all(), fn ($v) => $v !== null));
            $rated = $tickets->whereNotNull('rating');
            $answered = $rated->whereNotNull('rating_resolved');

            $daily = [];
            for ($d = $days - 1; $d >= 0; $d--) {
                $daily[now()->subDays($d)->format('Y-m-d')] = 0;
            }
            foreach ($tickets as $t) {
                $key = $t->created_at?->format('Y-m-d');
                if ($key !== null && isset($daily[$key])) {
                    $daily[$key]++;
                }
            }

            return $this->ok([
                'days' => $days,
                'opened' => $tickets->count(),
                'closed' => $tickets->where('status', SupportStatus::Closed)->count(),
                'auto_closed' => $tickets->where('close_reason', 'auto')->count(),
                'waiting_now' => SupportTicket::query()->where('status', SupportStatus::WaitingSupport->value)->count(),
                'first_reply_minutes' => $avg($firstReplies),
                'resolution_minutes' => $avg($resolutions),
                'rating' => $rated->isEmpty() ? null : round((float) $rated->avg('rating'), 2),
                'rated' => $rated->count(),
                'satisfied_percent' => $rated->isEmpty() ? null : round($rated->where('rating', '>=', 4)->count() / $rated->count() * 100, 1),
                'resolved_percent' => $answered->isEmpty() ? null : round($answered->where('rating_resolved', true)->count() / $answered->count() * 100, 1),
                'stars' => collect([5, 4, 3, 2, 1])->mapWithKeys(fn (int $s) => [$s => $rated->where('rating', $s)->count()])->all(),
                'topics' => $tickets->groupBy(fn (SupportTicket $t) => $t->topic->value)->map->count()->sortDesc()->all(),
                'daily' => array_map(fn ($date, $n) => ['date' => $date, 'count' => $n], array_keys($daily), array_values($daily)),
                'low_ratings' => $rated->where('rating', '<=', 2)->sortByDesc('rated_at')->take(10)->map(fn (SupportTicket $t) => [
                    'number' => $t->number,
                    'store' => $t->tenant?->name,
                    'rating' => $t->rating,
                    'resolved' => $t->rating_resolved,
                    'comment' => $t->rating_comment,
                    'rated_at' => $t->rated_at?->toIso8601ZuluString(),
                ])->values()->all(),
            ]);
        });
    }

    private function find(int $number): SupportTicket
    {
        return Tenancy::withoutTenant(fn () => SupportTicket::query()->with('tenant:id,name,plan_key')->where('number', $number)->firstOrFail());
    }

    /** @return array<string, mixed> */
    private function conversation(SupportTicket $ticket, ?int $before): array
    {
        $page = SupportMessage::query()->with('attachments')->where('support_ticket_id', $ticket->id)
            ->when($before !== null, fn ($q) => $q->where('id', '<', $before))
            ->orderByDesc('id')->limit(self::PAGE + 1)->get();
        $more = $page->count() > self::PAGE;
        $messages = $page->take(self::PAGE)->reverse()->values();
        $history = SupportTicket::query()->where('id', '!=', $ticket->id)->latest('id')->limit(10)
            ->get(['number', 'topic', 'status', 'rating', 'created_at'])
            ->map(fn (SupportTicket $t) => ['number' => $t->number, 'topic' => $t->topic->value, 'status' => $t->status->value, 'rating' => $t->rating, 'created_at' => $t->created_at?->toIso8601ZuluString()])->all();

        return [
            'ticket' => [...$this->presenter->ticket($ticket, $messages->last()), 'context' => $ticket->context, 'plan' => $ticket->tenant?->getAttribute('plan_key')],
            'messages' => $messages->map(fn (SupportMessage $m) => $this->presenter->message($m))->all(),
            'has_more' => $more,
            'history' => $history,
        ];
    }

    /**
     * @param  list<SupportTicket>  $tickets
     * @return list<array<string, mixed>>
     */
    private function rows(array $tickets): array
    {
        $ids = array_values(array_filter(array_map(fn (SupportTicket $t) => $t->getAttribute('messages_max_id'), $tickets)));
        $last = SupportMessage::query()->whereIn('id', $ids === [] ? [0] : $ids)->withCount('attachments')->get()->keyBy('support_ticket_id');

        return array_map(function (SupportTicket $t) use ($last): array {
            $message = $last->get($t->id);
            $row = $this->presenter->ticket($t);
            if ($message !== null) {
                $row['last_message'] = ['sender' => $message->sender, 'preview' => mb_substr((string) $message->body, 0, 120), 'files' => (int) $message->getAttribute('attachments_count')];
            }

            return $row;
        }, $tickets);
    }
}
