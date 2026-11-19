<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Ai\Designer\AiDesigner;
use App\Ai\Designer\AiDesignRunner;
use App\Ai\Images\StockPhotos;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\AiDesignerApproveRequest;
use App\Http\Requests\Dashboard\AiDesignerChatRequest;
use App\Http\Requests\Dashboard\AiDesignerMessageRequest;
use App\Http\Requests\Dashboard\AiDesignRunStartRequest;
use App\Http\Requests\Dashboard\AiDesignRunVersionRequest;
use App\Models\AiChat;
use App\Models\AiChatMessage;
use App\Models\AiDesignRun;
use App\Models\AiSectionVersion;
use App\Models\Tenant;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;

/**
 * Endpoints for «المصمم الذكي» under `/api/v1/dashboard/ai/designer` (docs/plans/ai-designer.md §2.6 & §4.4–4.6).
 */
final class AiDesignerController extends Controller
{
    public function __construct(
        private readonly AiDesigner $designer,
        private readonly AiDesignRunner $runner,
        private readonly StockPhotos $stock,
    ) {}

    public function status(): JsonResponse
    {
        return $this->ok([
            'enabled' => $this->designer->enabled(),
            'stock' => $this->stock->configured(),
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

        $pending->load('version.section');

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

    public function approveVersion(AiDesignerApproveRequest $request, AiSectionVersion $version): JsonResponse
    {
        $name = $request->validated('name');
        $mode = (string) ($request->validated('mode') ?? 'replace');

        return $this->ok($this->designer->approve(
            $version,
            is_string($name) ? $name : null,
            $mode,
        ));
    }

    public function rejectVersion(AiSectionVersion $version): JsonResponse
    {
        return $this->ok($this->designer->reject($version));
    }

    public function startRun(AiDesignRunStartRequest $request, AiChatMessage $message): JsonResponse
    {
        $tenant = Tenant::query()->findOrFail(Tenancy::id());
        $custom = (array) ($request->validated('custom') ?? []);
        $run = $this->runner->startFromPlan($tenant, $message, $custom);

        return response()->json([
            'data' => $this->runner->formatRun($run, $message->chat),
        ], 202);
    }

    public function showRun(AiDesignRun $run): JsonResponse
    {
        $run->loadMissing('chat');

        return $this->ok($this->runner->formatRun($run, $run->chat, true));
    }

    public function applyRun(AiDesignRunVersionRequest $request, AiDesignRun $run): JsonResponse
    {
        return $this->ok($this->runner->apply($run, (int) $request->validated('version')));
    }

    public function rejectRun(AiDesignRun $run): JsonResponse
    {
        return $this->ok($this->runner->reject($run));
    }

    public function revertRun(AiDesignRunVersionRequest $request, AiDesignRun $run): JsonResponse
    {
        return $this->ok($this->runner->revert($run, (int) $request->validated('version')));
    }
}
