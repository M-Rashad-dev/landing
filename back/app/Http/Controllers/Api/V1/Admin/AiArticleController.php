<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\ManageTenant;
use App\Ai\Knowledge;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AiArticleRequest;
use App\Models\AiArticle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * The support assistant's knowledge base (admin «معلومات المساعد»): list, write, edit, switch off,
 * delete. Every save cuts the article again and queues its vectors.
 */
final class AiArticleController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly Knowledge $knowledge, private readonly ManageTenant $audit) {}

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate(['category' => ['nullable', 'string', 'max:30'], 'q' => ['nullable', 'string', 'max:100']]);
        $q = trim((string) ($data['q'] ?? ''));
        $like = '%'.addcslashes($q, '%_\\').'%';
        $articles = AiArticle::query()
            ->withCount('chunks')
            ->when(($data['category'] ?? null) !== null, fn ($w) => $w->where('category', $data['category']))
            ->when($q !== '', fn ($w) => $w->where(fn ($s) => $s->where('title', 'like', $like)->orWhere('body', 'like', $like)))
            ->orderBy('category')->orderBy('title')->get();

        return $this->ok($articles->map(fn (AiArticle $a) => $this->row($a))->all(), ['categories' => AiArticle::CATEGORIES]);
    }

    public function store(AiArticleRequest $request): JsonResponse
    {
        $article = AiArticle::query()->create($this->clean($request) + ['updated_by' => $request->user()?->getAuthIdentifier()]);
        $this->knowledge->refresh($article);
        $this->audit->audit('ai.article.create', (string) $article->id, ['title' => $article->title], 'ai_article');

        return $this->created($this->row($article->refresh()->loadCount('chunks')));
    }

    public function update(AiArticleRequest $request, int $article): JsonResponse
    {
        $model = AiArticle::query()->findOrFail($article);
        $model->fill($this->clean($request) + ['updated_by' => $request->user()?->getAuthIdentifier()])->save();
        $this->knowledge->refresh($model);
        $this->audit->audit('ai.article.update', (string) $model->id, ['title' => $model->title], 'ai_article');

        return $this->ok($this->row($model->refresh()->loadCount('chunks')));
    }

    public function destroy(int $article): Response
    {
        $model = AiArticle::query()->findOrFail($article);
        $model->delete();
        Knowledge::forget();
        $this->audit->audit('ai.article.delete', (string) $article, ['title' => $model->title], 'ai_article');

        return response()->noContent();
    }

    /** @return array{title: string, category: string, body: string, is_active: bool} */
    private function clean(AiArticleRequest $request): array
    {
        $data = $request->validated();

        return [
            'title' => trim(strip_tags((string) $data['title'])),
            'category' => (string) $data['category'],
            'body' => trim(strip_tags((string) $data['body'])),
            'is_active' => (bool) $data['is_active'],
        ];
    }

    /** @return array<string, mixed> */
    private function row(AiArticle $a): array
    {
        return [
            'id' => $a->id,
            'title' => $a->title,
            'category' => $a->category,
            'body' => $a->body,
            'is_active' => $a->is_active,
            'pieces' => (int) ($a->chunks_count ?? 0),
            // ready = the assistant can use it; waiting = vectors not made yet (the assistant off, or soon).
            'state' => $a->embedded_at !== null ? 'ready' : ($a->embed_error !== null ? 'failed' : 'waiting'),
            'error' => $a->embed_error,
            'updated_at' => $a->updated_at?->toIso8601String(),
        ];
    }
}
