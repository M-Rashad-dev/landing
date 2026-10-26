<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Actions\Media\DeleteMedia;
use App\Actions\Media\UploadMedia;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\UpdateMediaRequest;
use App\Http\Requests\Dashboard\UploadMediaRequest;
use App\Http\Resources\MediaResource;
use App\Models\Media;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\UploadedFile;

final class MediaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('q', ''));
        // ?ids=1,2,3 resolves specific items (used by pickers that store ids only).
        $ids = array_values(array_filter(array_map('intval', explode(',', (string) $request->query('ids', '')))));

        $media = Media::query()
            ->when($ids !== [], fn ($q) => $q->whereIn('id', array_slice($ids, 0, 100)))
            ->when($search !== '', fn ($q) => $q->where(fn ($w) => $w
                ->where('original_name', 'like', '%'.addcslashes($search, '%_\\').'%')
                ->orWhere('alt', 'like', '%'.addcslashes($search, '%_\\').'%')))
            ->latest('id')
            ->paginate($this->perPage($request));

        return $this->paginated($media, MediaResource::class);
    }

    public function store(UploadMediaRequest $request, UploadMedia $action): JsonResponse
    {
        /** @var list<UploadedFile> $files */
        $files = array_values($request->file('files', []));
        $media = $action->handle($files, (string) $request->validated('purpose', 'general'));

        return $this->created(MediaResource::collection($media)->resolve($request));
    }

    public function update(UpdateMediaRequest $request, Media $media): JsonResponse
    {
        $media->update(['alt' => $request->validated('alt')]);

        return $this->ok(MediaResource::make($media));
    }

    public function destroy(Media $media, DeleteMedia $action): Response
    {
        $action->handle($media);

        return $this->noContent();
    }
}
