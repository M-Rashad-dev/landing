<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Enums\SupportStatus;
use App\Enums\SupportTopic;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\SupportMessageRequest;
use App\Http\Requests\Dashboard\SupportOpenRequest;
use App\Models\SupportAttachment;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Models\Tenant;
use App\Services\Support\SupportDesk;
use App\Services\Support\SupportFiles;
use App\Services\Support\SupportPresenter;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * The store's side of the support chat: its conversations (by number), open one, write, read,
 * close, rate, and see the files sent. The merchant only ever talks to "support".
 */
final class SupportController extends Controller
{
    use RespondsWithJson;

    private const PAGE = 50;

    public function __construct(private readonly SupportDesk $desk, private readonly SupportPresenter $presenter) {}

    /** The bubble's badge and whether a new conversation can be opened now. */
    public function summary(): JsonResponse
    {
        $open = SupportTicket::query()->where('status', '!=', SupportStatus::Closed->value)->get();
        $unread = SupportTicket::query()->whereNotNull('last_support_message_at')
            ->where(fn ($q) => $q->whereNull('merchant_read_at')->orWhereColumn('merchant_read_at', '<', 'last_support_message_at'))
            ->count();
        $reason = $this->desk->cannotOpen();

        return $this->ok(['unread' => $unread, 'open' => $open->count(), 'can_open' => $reason === null, 'reason' => $reason]);
    }

    public function index(): JsonResponse
    {
        // Open conversations first, then the latest.
        $tickets = SupportTicket::query()->withMax('messages', 'id')->latest('last_message_at')->limit(50)->get()
            ->sortBy(fn (SupportTicket $t) => $t->status->isOpen() ? 0 : 1)->values();

        return $this->ok($this->rows($tickets->all()));
    }

    public function store(SupportOpenRequest $request): JsonResponse
    {
        $ticket = $this->desk->open(
            (int) $request->user()?->getAuthIdentifier(),
            SupportTopic::from((string) $request->validated('topic')),
            $request->body(),
            $request->uploads(),
            [
                'page' => $request->validated('page'),
                'agent' => mb_substr((string) $request->userAgent(), 0, 300),
                'plan' => Tenant::query()->whereKey(Tenancy::id())->value('plan_key'),
            ],
        );

        return $this->created($this->conversation($ticket, null));
    }

    /** The conversation; `before` (a message id) pages back through older messages. */
    public function show(Request $request, int $number): JsonResponse
    {
        $before = $request->integer('before') ?: null;

        return $this->ok($this->conversation($this->find($number), $before));
    }

    public function message(SupportMessageRequest $request, int $number): JsonResponse
    {
        $message = $this->desk->reply($this->find($number), SupportMessage::MERCHANT, (int) $request->user()?->getAuthIdentifier(), $request->body(), $request->uploads());

        return $this->created($this->presenter->message($message));
    }

    public function read(int $number): JsonResponse
    {
        $ticket = $this->find($number);
        $this->desk->read($ticket, SupportMessage::MERCHANT);

        return $this->ok($this->presenter->ticket($ticket));
    }

    public function close(Request $request, int $number): JsonResponse
    {
        $ticket = $this->find($number);
        $this->desk->close($ticket, 'merchant', (int) $request->user()?->getAuthIdentifier());

        return $this->ok($this->presenter->ticket($ticket->refresh()));
    }

    public function rate(Request $request, int $number): JsonResponse
    {
        $data = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
            'resolved' => ['required', 'boolean'],
            'comment' => ['nullable', 'string', 'max:500'],
        ]);
        $ticket = $this->find($number);
        $comment = isset($data['comment']) ? (trim(strip_tags($data['comment'])) ?: null) : null;
        $this->desk->rate($ticket, (int) $data['rating'], (bool) $data['resolved'], $comment);

        return $this->ok($this->presenter->ticket($ticket->refresh()));
    }

    /** An image or video of the store's own conversation (videos stream in parts). */
    public function attachment(int $id, SupportFiles $files): BinaryFileResponse
    {
        $attachment = SupportAttachment::query()->findOrFail($id);

        return response()->file($files->absolutePath($attachment), [
            'Content-Type' => $attachment->mime,
            'Cache-Control' => 'private, max-age=86400',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function find(int $number): SupportTicket
    {
        return SupportTicket::query()->where('number', $number)->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function conversation(SupportTicket $ticket, ?int $before): array
    {
        $page = $ticket->messages()->getQuery()->with('attachments')
            ->when($before !== null, fn ($q) => $q->where('id', '<', $before))
            ->reorder('id', 'desc')->limit(self::PAGE + 1)->get();
        $more = $page->count() > self::PAGE;
        $messages = $page->take(self::PAGE)->reverse()->values();

        return [
            'ticket' => $this->presenter->ticket($ticket, $messages->last()),
            'messages' => $messages->map(fn (SupportMessage $m) => $this->presenter->message($m))->all(),
            'has_more' => $more,
        ];
    }

    /**
     * @param  list<SupportTicket>  $tickets  loaded with messages_max_id
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
