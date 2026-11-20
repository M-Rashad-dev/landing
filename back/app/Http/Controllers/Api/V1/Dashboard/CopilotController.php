<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Ai\Copilot\CopilotChats;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\CopilotMessageRequest;
use App\Models\CopilotChat;
use App\Models\Tenant;
use App\Models\User;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The store copilot's chat under `/api/v1/dashboard/ai/copilot` (docs/plans/ai-copilot.md §3.14). */
final class CopilotController extends Controller
{
    public function __construct(private readonly CopilotChats $chats) {}

    public function status(): JsonResponse
    {
        return $this->ok(['enabled' => $this->chats->enabled()]);
    }

    /** The open chat (created when there is none) with its latest messages. */
    public function chat(Request $request): JsonResponse
    {
        return $this->ok($this->chats->format($this->chats->open($this->user($request))));
    }

    public function newChat(Request $request): JsonResponse
    {
        return $this->ok($this->chats->format($this->chats->newChat($this->user($request))));
    }

    public function show(Request $request, CopilotChat $chat): JsonResponse
    {
        $this->own($request, $chat);
        $before = $request->integer('before');

        return $this->ok($this->chats->format($chat, $before > 0 ? $before : null));
    }

    public function send(CopilotMessageRequest $request, CopilotChat $chat): JsonResponse
    {
        $this->own($request, $chat);
        $pending = $this->chats->send(
            $chat,
            $this->user($request),
            Tenant::query()->findOrFail(Tenancy::id()),
            (string) $request->validated('text'),
            $request->mediaIds(),
            $request->context(),
        );

        return response()->json(['data' => $this->chats->message($pending)], 202);
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }

    /** A chat is its user's own: anyone else (even in the same store) gets 404. */
    private function own(Request $request, CopilotChat $chat): void
    {
        abort_if($chat->user_id !== $this->user($request)->id, 404);
    }
}
