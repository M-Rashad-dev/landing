<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\ManageTenant;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Jobs\RevalidateFrontendTags;
use App\Models\PlatformPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The platform's pages (about, terms, privacy, refunds, acceptable use): the super admin edits
 * their title, summary, Markdown text and whether they show. The set of pages is fixed.
 */
final class PlatformPageController extends Controller
{
    use RespondsWithJson;

    public const CACHE_TAG = 'platform-pages';

    public function index(): JsonResponse
    {
        $pages = PlatformPage::query()->with('editor:id,name')->orderBy('sort_order')->get();

        return $this->ok($pages->map(fn (PlatformPage $p) => $this->row($p, false))->all());
    }

    public function show(string $slug): JsonResponse
    {
        return $this->ok($this->row($this->find($slug), true));
    }

    public function update(Request $request, string $slug, ManageTenant $audit): JsonResponse
    {
        $page = $this->find($slug);
        $data = $request->validate([
            'title' => ['required', 'string', 'min:2', 'max:120'],
            'summary' => ['nullable', 'string', 'max:300'],
            'body' => ['required', 'string', 'min:20', 'max:60000'],
            'is_published' => ['required', 'boolean'],
        ]);
        $before = ['title' => $page->title, 'is_published' => $page->is_published, 'length' => mb_strlen($page->body)];

        // Markdown is kept as written (the page renders it without raw HTML); plain fields lose tags.
        $page->update([
            'title' => trim(strip_tags($data['title'])),
            'summary' => isset($data['summary']) ? (trim(strip_tags($data['summary'])) ?: null) : null,
            'body' => str_replace("\r\n", "\n", $data['body']),
            'is_published' => (bool) $data['is_published'],
            'updated_by' => $request->user()?->getAuthIdentifier(),
        ]);
        $audit->audit('platform_page.update', $page->slug, ['before' => $before, 'after' => ['title' => $page->title, 'is_published' => $page->is_published, 'length' => mb_strlen($page->body)]], 'platform_page');
        RevalidateFrontendTags::dispatch([self::CACHE_TAG])->afterCommit();

        return $this->ok($this->row($page->load('editor:id,name'), true));
    }

    private function find(string $slug): PlatformPage
    {
        return PlatformPage::query()->with('editor:id,name')->where('slug', $slug)->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function row(PlatformPage $page, bool $withBody): array
    {
        $row = [
            'slug' => $page->slug,
            'title' => $page->title,
            'summary' => $page->summary,
            'is_published' => $page->is_published,
            'updated_at' => $page->updated_at?->toIso8601ZuluString(),
            'updated_by' => $page->editor?->name,
        ];

        return $withBody ? [...$row, 'body' => $page->body] : $row;
    }
}
