<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Ai\Copilot\CopilotChats;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Ai\Copilot\Support\ExportBuilder;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\CopilotExportRequest;
use App\Http\Requests\Dashboard\CopilotMessageRequest;
use App\Http\Requests\Dashboard\ProductImportUploadRequest;
use App\Imports\Products\ImportFiles;
use App\Models\CopilotChat;
use App\Models\CopilotExport;
use App\Models\Tenant;
use App\Models\User;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** The store copilot's chat under `/api/v1/dashboard/ai/copilot` (docs/plans/ai-copilot.md §3.14). */
final class CopilotController extends Controller
{
    public function __construct(private readonly CopilotChats $chats, private readonly ExportBuilder $exports) {}

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
            $request->importId(),
        );

        return response()->json(['data' => $this->chats->message($pending)], 202);
    }

    /**
     * A sheet attached in the chat: uploaded with the product importer's own code (its column guess), then the message
     * carries its import_id so the copilot can import it (products.import).
     */
    public function attachSheet(ProductImportUploadRequest $request, ImportFiles $files): JsonResponse
    {
        $import = $files->upload($request->file('file'), $request->user()?->getAuthIdentifier());

        return $this->created(['import_id' => $import->id, 'file_name' => $import->file_name, 'rows' => (int) $import->total_rows]);
    }

    /** «نزّل إكسيل» under a table card: builds the file of the same source (free, no AI). */
    public function buildExport(CopilotExportRequest $request): JsonResponse
    {
        $user = $this->user($request);
        $ctx = new CopilotContext(Tenant::query()->findOrFail(Tenancy::id()), $user, $this->chats->open($user));
        try {
            $export = $this->exports->build($request->source(), $request->validated('filename'), $ctx);
        } catch (CopilotToolError $e) {
            throw new ApiException(422, 'export_failed', $e->getMessage());
        }

        return $this->ok(ExportBuilder::block($export));
    }

    /** Downloads a copilot file of this store until it expires (24 hours). */
    public function downloadExport(string $token): StreamedResponse
    {
        $export = CopilotExport::query()->where('token', $token)->where('expires_at', '>', now())->first();
        abort_if($export === null || ! Storage::disk(ExportBuilder::DISK)->exists($export->path), 404);

        return Storage::disk(ExportBuilder::DISK)->download($export->path, $export->filename, ['Cache-Control' => 'no-store']);
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
