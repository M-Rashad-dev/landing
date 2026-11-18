<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Ai\Designer\AiDesigner;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\AiDesignerChatRequest;
use App\Http\Requests\Dashboard\AiDesignerMessageRequest;
use App\Models\AiChat;
use App\Models\AiSectionVersion;
use App\Models\Tenant;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;

/**
 * Endpoints for «المصمم الذكي» under `/api/v1/dashboard/ai/designer` (docs/plans/ai-designer.md §2.6).
 */
final class AiDesignerController extends Controller
{
    public function __construct(private readonly AiDesigner $designer) {}

    public function status(): JsonResponse
    {
        return $this->ok([
            'enabled' => $this->designer->enabled(),
        ]);
    }

    public function chat(AiDesignerChatRequest $request): JsonResponse
    {
        $tenant = Tenant::query()->findOrFail(Tenancy::id());
        $chat = $this->designer->chat(
            $tenant,
            (string) $request->validated('kind'),
            (string) $request->validated('theme_key'),
            $request->validated('landing_page_id') === null ? null : (int) $request->validated('landing_page_id'),
        );

        return $this->ok($this->designer->formatChat($chat));
    }

    public function newChat(AiDesignerChatRequest $request): JsonResponse
    {
        $tenant = Tenant::query()->findOrFail(Tenancy::id());
        $chat = $this->designer->newChat(
            $tenant,
            (string) $request->validated('kind'),
            (string) $request->validated('theme_key'),
            $request->validated('landing_page_id') === null ? null : (int) $request->validated('landing_page_id'),
        );

        return $this->ok($this->designer->formatChat($chat));
    }

    public function showChat(AiChat $chat): JsonResponse
    {
        return $this->ok($this->designer->formatChat($chat));
    }

    public function sendMessage(AiDesignerMessageRequest $request, AiChat $chat): JsonResponse
    {
        $tenant = Tenant::query()->findOrFail(Tenancy::id());
        $mediaIds = array_values(array_map('intval', (array) ($request->validated('media_ids') ?? [])));
        $focusId = $request->validated('focus_section_id') === null
            ? null
            : (int) $request->validated('focus_section_id');

        $pending = $this->designer->send(
            $tenant,
            $chat,
            (string) $request->validated('text'),
            $mediaIds,
            $focusId,
        );

        $pending->load('version');

        return response()->json([
            'data' => [
                'id' => $pending->id,
                'role' => $pending->role,
                'text' => $pending->text,
                'media' => [],
                'status' => $pending->status,
                'error' => $pending->error,
                'focus_section_id' => $pending->focus_section_id,
                'version' => $pending->version instanceof AiSectionVersion
                    ? $this->designer->formatVersion($pending->version)
                    : null,
                'created_at' => $pending->created_at?->toIso8601ZuluString(),
            ],
        ], 202);
    }

    public function approveVersion(AiSectionVersion $version): JsonResponse
    {
        return $this->ok($this->designer->approve($version));
    }

    public function rejectVersion(AiSectionVersion $version): JsonResponse
    {
        return $this->ok($this->designer->reject($version));
    }
}
