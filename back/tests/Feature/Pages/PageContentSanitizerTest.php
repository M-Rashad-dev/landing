<?php

declare(strict_types=1);

use App\Models\Media;
use App\Models\Tenant;
use App\Services\PageContentSanitizer;
use App\Tenancy\Tenancy;
use Database\Factories\LandingPageFactory;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    $this->tenant = Tenant::factory()->create();
    Tenancy::context()->set($this->tenant->id);
    $this->sanitizer = new PageContentSanitizer;
});

afterEach(fn () => Tenancy::context()->clear());

function content(array ...$sections): array
{
    return ['version' => 1, 'sections' => $sections];
}

function sanitizeErrors(array $content): array
{
    try {
        test()->sanitizer->sanitize($content);

        return [];
    } catch (ValidationException $e) {
        return $e->errors();
    }
}

it('keeps valid content and lowercases ids', function () {
    $section = LandingPageFactory::section('hero', ['title' => 'عنوان', 'cta_url' => '#order', 'show_price' => true, 'overlay_opacity' => 40]);
    $section['id'] = strtoupper($section['id']);

    $result = $this->sanitizer->sanitize(content($section));

    expect($result['content']['sections'][0]['props'])->toBe(['title' => 'عنوان', 'cta_url' => '#order', 'show_price' => true, 'overlay_opacity' => 40])
        ->and($result['content']['sections'][0]['id'])->toBe(strtolower($section['id']));
});

it('strips html tags from every string', function () {
    $result = $this->sanitizer->sanitize(content(LandingPageFactory::section('faq', [
        'title' => '<script>alert(1)</script>أسئلة',
        'items' => [['question' => '<img src=x onerror=alert(1)>سؤال', 'answer' => '<b>جواب</b>']],
    ])));

    $props = $result['content']['sections'][0]['props'];
    expect($props['title'])->toBe('alert(1)أسئلة')
        ->and($props['items'][0]['question'])->toBe('سؤال')
        ->and($props['items'][0]['answer'])->toBe('جواب');
});

it('caps titles at 200 and other strings at 5000 chars', function () {
    $result = $this->sanitizer->sanitize(content(LandingPageFactory::section('hero', [
        'title' => str_repeat('ا', 300),
        'subtitle' => str_repeat('ب', 6000),
    ])));

    expect(mb_strlen($result['content']['sections'][0]['props']['title']))->toBe(200)
        ->and(mb_strlen($result['content']['sections'][0]['props']['subtitle']))->toBe(5000);
});

it('rejects unsafe urls with the exact path', function (string $url) {
    $errors = sanitizeErrors(content(
        LandingPageFactory::section('hero'),
        LandingPageFactory::section('header', ['links' => [['label' => 'x', 'link_url' => '#a'], ['label' => 'y', 'link_url' => $url]]]),
    ));

    expect($errors)->toHaveKey('content.sections.1.props.links.1.link_url');
})->with([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://insecure.com',
    '//evil.com',
    'vbscript:x',
    "java\tscript:alert(1)",
    'https://user:pass@evil.com',
]);

it('accepts every allowed link form', function (string $url) {
    expect(sanitizeErrors(content(LandingPageFactory::section('hero', ['cta_url' => $url]))))->toBe([]);
})->with(['#order', '#section-1a2b3c4d', '/offer', '/عرض', 'https://example.com/x', 'tel:+201012345678', 'mailto:a@b.co', 'https://wa.me/201012345678', '']);

it('validates colors', function () {
    expect(sanitizeErrors(content(LandingPageFactory::section('header', ['announcement_color' => 'red']))))
        ->toHaveKey('content.sections.0.props.announcement_color');

    $ok = $this->sanitizer->sanitize(content(LandingPageFactory::section('header', ['announcement_color' => '#ff00aa'])));
    expect($ok['content']['sections'][0]['props']['announcement_color'])->toBe('#FF00AA');
});

it('only accepts media of the current tenant', function () {
    $mine = Media::factory()->create();
    $foreign = Tenancy::runAs(Tenant::factory()->create()->id, fn () => Media::factory()->create());

    $result = $this->sanitizer->sanitize(content(LandingPageFactory::section('gallery', ['image_media_ids' => [$mine->id]]), LandingPageFactory::section('hero', ['image_media_id' => $mine->id])));
    expect($result['media_ids'])->toBe([$mine->id]);

    expect(sanitizeErrors(content(LandingPageFactory::section('hero', ['image_media_id' => $foreign->id]))))->toHaveKey('content.sections.0.props.image_media_id')
        ->and(sanitizeErrors(content(LandingPageFactory::section('gallery', ['image_media_ids' => [$mine->id, $foreign->id]]))))->toHaveKey('content.sections.0.props.image_media_ids.1');
});

it('rejects unknown types, bad ids, bad variants and non-boolean visibility', function () {
    $errors = sanitizeErrors(content(
        ['id' => 'not-a-uuid', 'type' => 'hero', 'variant' => 'split', 'visible' => true, 'props' => []],
        LandingPageFactory::section('script', []),
        array_merge(LandingPageFactory::section('hero'), ['variant' => '<x>']),
        array_merge(LandingPageFactory::section('faq'), ['visible' => 'yes']),
    ));

    expect($errors)->toHaveKeys(['content.sections.0.id', 'content.sections.1.type', 'content.sections.2.variant', 'content.sections.3.visible']);
});

it('rejects duplicate section ids', function () {
    $section = LandingPageFactory::section('hero');

    expect(sanitizeErrors(content($section, $section)))->toHaveKey('content.sections.1.id');
});

it('allows at most one header, footer and order form', function () {
    expect(sanitizeErrors(content(LandingPageFactory::section('header'), LandingPageFactory::section('header'))))->toHaveKey('content.sections.1.type')
        ->and(sanitizeErrors(content(LandingPageFactory::section('footer'), LandingPageFactory::section('footer'))))->toHaveKey('content.sections.1.type')
        ->and(sanitizeErrors(content(LandingPageFactory::section('order_form'), LandingPageFactory::section('order_form'))))->toHaveKey('content.sections.1.type');
});

it('limits sections, size, depth and array length', function () {
    $many = array_map(fn () => LandingPageFactory::section('features'), range(1, 31));
    expect(sanitizeErrors(['version' => 1, 'sections' => $many]))->toHaveKey('content.sections');

    expect(sanitizeErrors(content(LandingPageFactory::section('hero', ['subtitle' => str_repeat('x', 300 * 1024)]))))->toHaveKey('content');

    $deep = ['a' => ['b' => ['c' => ['d' => ['e' => ['f' => 1]]]]]];
    expect(sanitizeErrors(content(LandingPageFactory::section('hero', $deep))))->not->toBe([]);

    $longList = ['items' => array_map(fn ($i) => ['question' => "q{$i}"], range(1, 51))];
    expect(sanitizeErrors(content(LandingPageFactory::section('faq', $longList))))->toHaveKey('content.sections.0.props.items');
});

it('rejects suspicious keys and non-object props', function () {
    expect(sanitizeErrors(content(LandingPageFactory::section('hero', ['__proto__' => 1]))))->toHaveKey('content.sections.0.props.__proto__')
        ->and(sanitizeErrors(content(array_merge(LandingPageFactory::section('hero'), ['props' => ['a', 'b']]))))->toHaveKey('content.sections.0.props');
});

it('rejects malformed content', function (mixed $content) {
    expect(fn () => $this->sanitizer->sanitize($content))->toThrow(ValidationException::class);
})->with([
    'null' => [null],
    'string' => ['<script>'],
    'no sections' => [['version' => 1]],
    'sections object' => [['sections' => ['a' => []]]],
]);
