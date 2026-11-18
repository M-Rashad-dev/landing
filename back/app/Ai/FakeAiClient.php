<?php

declare(strict_types=1);

namespace App\Ai;

/**
 * The AI for tests and local e2e (AI_DRIVER=fake): nothing leaves the server and nothing is paid.
 * Answers what was queued (texts or AiError), else a fixed reply; vectors are a stable hash of
 * the text, so the same text always lands on the same vector.
 */
final class FakeAiClient implements AiClient
{
    /** @var list<string|AiError> */
    private array $queue = [];

    /** @var list<array{model: string, messages: array<int, mixed>, options: array<string, mixed>}> */
    public array $chats = [];

    /** @var list<list<string>> */
    public array $embedded = [];

    public function __construct(private bool $configured = true) {}

    public function configured(): bool
    {
        return $this->configured;
    }

    /** The next answers, in order (an AiError is thrown instead of answered). */
    public function answer(string|AiError ...$replies): self
    {
        array_push($this->queue, ...$replies);

        return $this;
    }

    public function chat(string $model, array $messages, array $options = []): AiReply
    {
        $this->chats[] = ['model' => $model, 'messages' => $messages, 'options' => $options];
        $next = array_shift($this->queue) ?? self::defaultReply($messages);
        if ($next instanceof AiError) {
            throw $next;
        }

        return new AiReply($next, $model, inputTokens: 1000, outputTokens: 200, cachedTokens: 400);
    }

    /**
     * @param  array<int, mixed>  $messages
     */
    private static function defaultReply(array $messages): string
    {
        $systemText = '';
        $lastUserText = '';
        foreach ($messages as $msg) {
            if (! is_array($msg)) {
                continue;
            }
            if (($msg['role'] ?? null) === 'system' && is_string($msg['content'] ?? null)) {
                $systemText = $msg['content'];
            }
            if (($msg['role'] ?? null) === 'user') {
                if (is_string($msg['content'] ?? null)) {
                    $lastUserText = $msg['content'];
                } elseif (is_array($msg['content'] ?? null)) {
                    foreach ($msg['content'] as $part) {
                        if (is_array($part) && ($part['type'] ?? null) === 'text' && is_string($part['text'] ?? null)) {
                            $lastUserText = $part['text'];
                        }
                    }
                }
            }
        }

        if (! str_contains($systemText, 'MKSAB_AI_DESIGNER')) {
            return 'تمام.';
        }

        if (! str_contains($lastUserText, 'قسم')) {
            if (str_contains($lastUserText, 'شيل الخلفية') || str_contains($lastUserText, 'بدون خلفية') || str_contains($lastUserText, 'إزالة الخلفية') || str_contains($lastUserText, 'ازالة الخلفية')) {
                return (string) json_encode([
                    'reply' => 'شلت الخلفية من صورة المنتج وحفظتهالك في مكتبة الصور.',
                    'action' => 'images',
                    'images' => [
                        [
                            'id' => 'i1',
                            'action' => 'remove_bg',
                            'upload' => 1,
                            'use' => 'صورة المنتج بدون خلفية',
                        ],
                    ],
                ], JSON_UNESCAPED_UNICODE);
            }

            if (str_contains($lastUserText, 'استوديو')) {
                return (string) json_encode([
                    'reply' => 'حطيت المنتج على خلفية استوديو احترافية وحفظت الصورة في مكتبتك.',
                    'action' => 'images',
                    'images' => [
                        [
                            'id' => 'i1',
                            'action' => 'studio',
                            'upload' => 1,
                            'prompt' => 'clean luxury studio podium background with soft commercial lighting',
                            'use' => 'صورة المنتج في الاستوديو',
                        ],
                    ],
                ], JSON_UNESCAPED_UNICODE);
            }

            if (str_contains($lastUserText, 'حسن') || str_contains($lastUserText, 'جودة')) {
                return (string) json_encode([
                    'reply' => 'حسّنت إضاءة وجودة الصورة وحفظتها في مكتبة الصور.',
                    'action' => 'images',
                    'images' => [
                        [
                            'id' => 'i1',
                            'action' => 'enhance',
                            'upload' => 1,
                            'use' => 'صورة محسنة',
                        ],
                    ],
                ], JSON_UNESCAPED_UNICODE);
            }

            if (str_contains($lastUserText, 'صورة')) {
                return (string) json_encode([
                    'reply' => 'جهزتلك صورة البنر وحفظتها في مكتبة الصور، تقدر تستخدمها على طول.',
                    'action' => 'images',
                    'images' => [
                        [
                            'id' => 'i1',
                            'action' => 'generate',
                            'prompt' => 'professional commercial product photography banner on warm minimalist studio surface, soft shadows, high resolution',
                            'use' => 'صورة بنر',
                        ],
                    ],
                ], JSON_UNESCAPED_UNICODE);
            }
        }

        $editOf = null;
        if (preg_match('/Focused section ID:\s*(\d+)/i', $systemText, $m)) {
            $editOf = (int) $m[1];
        }

        $isLanding = (bool) preg_match('/Kind:\s*landing/i', $systemText);

        if ($isLanding) {
            return (string) json_encode([
                'reply' => 'صممتلك قسم بنر احترافي مع سلايدر مميزات وزرار طلب مباشر، تقدر تعاينه وتعتمده دلوقتي.',
                'action' => 'section',
                'section' => [
                    'edit_of' => $editOf,
                    'name' => 'بنر وسلايدر مميزات المنتج',
                    'html' => '<section class="ai-hero-split">'
                        .'<div class="ai-hero-banner">'
                        .'<img src="{{img banner_image}}" alt="{{title}}" loading="lazy">'
                        .'<div class="ai-hero-copy">'
                        .'<h2>{{title}}</h2>'
                        .'<p>{{subtitle}}</p>'
                        .'<a href="{{order_link}}" class="ai-cta-btn">{{button_text}}</a>'
                        .'</div>'
                        .'</div>'
                        .'<div class="ai-slider-wrap" data-ai-behavior="slider" data-ai-loop="true">'
                        .'<div class="ai-slider-head">'
                        .'<button type="button" data-ai-prev="true">السابق</button>'
                        .'<button type="button" data-ai-next="true">التالي</button>'
                        .'</div>'
                        .'<div class="ai-slider-track" data-ai-track="true">'
                        .'{{#each items}}'
                        .'<div class="ai-slide-card">'
                        .'<strong>{{heading}}</strong>'
                        .'<p>{{detail}}</p>'
                        .'</div>'
                        .'{{/each}}'
                        .'</div>'
                        .'<div class="ai-slider-dots" data-ai-dots="true"></div>'
                        .'</div>'
                        .'</section>',
                    'css' => '.ai-hero-split { display: grid; gap: 24px; padding: 32px 20px; background: var(--ai-bg); color: var(--ai-text); }'
                        .' @media (min-width: 1024px) { .ai-hero-split { grid-template-columns: 1fr 1.2fr; align-items: center; padding: 48px 32px; } }'
                        .' .ai-hero-banner { position: relative; border-radius: var(--ai-radius); overflow: hidden; border: 1px solid var(--ai-border); }'
                        .' .ai-hero-banner img { width: 100%; height: 260px; object-fit: cover; display: block; }'
                        .' .ai-hero-copy { padding: 20px; }'
                        .' .ai-hero-copy h2 { font-family: var(--ai-font-display); font-size: 1.5rem; font-weight: 800; margin: 0 0 8px; }'
                        .' .ai-hero-copy p { color: var(--ai-muted); margin: 0 0 16px; }'
                        .' .ai-cta-btn { display: inline-block; padding: 10px 22px; border-radius: var(--ai-radius); background: var(--ai-primary); color: var(--ai-on-primary); font-weight: 700; text-decoration: none; }'
                        .' .ai-slider-wrap { display: flex; flex-direction: column; gap: 12px; }'
                        .' .ai-slider-head { display: flex; gap: 8px; justify-content: flex-end; }'
                        .' .ai-slider-head button { padding: 6px 14px; border-radius: var(--ai-radius); border: 1px solid var(--ai-border); background: var(--ai-bg); color: var(--ai-text); }'
                        .' .ai-slider-track { display: flex; gap: 16px; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 8px; }'
                        .' .ai-slide-card { min-width: 220px; scroll-snap-align: start; padding: 18px; border-radius: var(--ai-radius); border: 1px solid var(--ai-border); }'
                        .' .ai-slide-card strong { display: block; margin-bottom: 6px; font-weight: 700; }'
                        .' .ai-slide-card p { margin: 0; color: var(--ai-muted); font-size: 0.9rem; }',
                    'fields' => [
                        ['key' => 'banner_image', 'type' => 'image', 'label' => 'صورة البنر'],
                        ['key' => 'title', 'type' => 'text', 'label' => 'العنوان الرئيسي', 'sample' => 'عرض خاص لفترة محدودة'],
                        ['key' => 'subtitle', 'type' => 'textarea', 'label' => 'الوصف', 'sample' => 'أفضل خامة وأسرع توصيل لحد باب البيت مع ضمان الاستبدال.'],
                        ['key' => 'button_text', 'type' => 'text', 'label' => 'نص الزرار', 'sample' => 'اطلب دلوقتي'],
                        [
                            'key' => 'items',
                            'type' => 'list',
                            'label' => 'كروت المميزات',
                            'max' => 6,
                            'fields' => [
                                ['key' => 'heading', 'type' => 'text', 'label' => 'عنوان الميزة', 'sample' => 'جودة مضمونة'],
                                ['key' => 'detail', 'type' => 'text', 'label' => 'وصف الميزة', 'sample' => 'خامات أصلية ومختبرة بالكامل'],
                            ],
                            'sample' => [
                                ['heading' => 'شحن سريع', 'detail' => 'توصيل لكل المحافظات خلال أيام'],
                                ['heading' => 'دفع عند الاستلام', 'detail' => 'عاين طلبك الأول قبل الدفع'],
                                ['heading' => 'ضمان استبدال', 'detail' => 'استبدال مجاني خلال 14 يوم'],
                            ],
                        ],
                    ],
                ],
            ], JSON_UNESCAPED_UNICODE);
        }

        return (string) json_encode([
            'reply' => 'صممتلك قسم بنر جانبي مع سلايدر منتجات متحرك، تقدر تعاينه على الكمبيوتر والموبايل وتعتمده.',
            'action' => 'section',
            'section' => [
                'edit_of' => $editOf,
                'name' => 'بنر جانبي مع سلايدر منتجات',
                'html' => '<section class="ai-split-showcase">'
                    .'<div class="ai-side-banner">'
                    .'<img src="{{img banner_image}}" alt="{{title}}" loading="lazy">'
                    .'<div class="ai-side-content">'
                    .'<h2>{{title}}</h2>'
                    .'<p>{{subtitle}}</p>'
                    .'</div>'
                    .'</div>'
                    .'<div class="ai-products-slider" data-ai-behavior="slider" data-ai-loop="true">'
                    .'<div class="ai-slider-controls">'
                    .'<button type="button" data-ai-prev="true">السابق</button>'
                    .'<button type="button" data-ai-next="true">التالي</button>'
                    .'</div>'
                    .'<div class="ai-track" data-ai-track="true">'
                    .'{{#each featured_products}}'
                    .'<article class="ai-prod-card">'
                    .'<a href="{{link url}}" class="ai-prod-img"><img src="{{img image}}" alt="{{name}}" loading="lazy"></a>'
                    .'<div class="ai-prod-body">'
                    .'<h3><a href="{{link url}}">{{name}}</a></h3>'
                    .'<div class="ai-prod-prices">'
                    .'<strong>{{price}}</strong>'
                    .'{{#if old_price}}<del>{{old_price}}</del>{{/if}}'
                    .'</div>'
                    .'<button type="button" class="ai-add-btn" data-ai-add="{{id}}">أضف للسلة</button>'
                    .'</div>'
                    .'</article>'
                    .'{{/each}}'
                    .'</div>'
                    .'<div class="ai-dots" data-ai-dots="true"></div>'
                    .'</div>'
                    .'</section>',
                'css' => '.ai-split-showcase { display: grid; gap: 24px; padding: 32px 20px; background: var(--ai-bg); color: var(--ai-text); }'
                    .' @media (min-width: 1024px) { .ai-split-showcase { grid-template-columns: 340px 1fr; align-items: stretch; padding: 48px 32px; } }'
                    .' .ai-side-banner { border-radius: var(--ai-radius); overflow: hidden; border: 1px solid var(--ai-border); display: flex; flex-direction: column; }'
                    .' .ai-side-banner img { width: 100%; height: 220px; object-fit: cover; display: block; }'
                    .' .ai-side-content { padding: 20px; }'
                    .' .ai-side-content h2 { font-family: var(--ai-font-display); font-size: 1.4rem; font-weight: 800; margin: 0 0 8px; }'
                    .' .ai-side-content p { color: var(--ai-muted); margin: 0; font-size: 0.95rem; }'
                    .' .ai-products-slider { display: flex; flex-direction: column; gap: 14px; min-width: 0; }'
                    .' .ai-slider-controls { display: flex; gap: 8px; justify-content: flex-end; }'
                    .' .ai-slider-controls button { padding: 6px 14px; border-radius: var(--ai-radius); border: 1px solid var(--ai-border); background: var(--ai-bg); color: var(--ai-text); }'
                    .' .ai-track { display: flex; gap: 16px; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 8px; }'
                    .' .ai-prod-card { min-width: 210px; max-width: 240px; flex-shrink: 0; scroll-snap-align: start; border-radius: var(--ai-radius); border: 1px solid var(--ai-border); overflow: hidden; display: flex; flex-direction: column; }'
                    .' .ai-prod-img img { width: 100%; height: 170px; object-fit: cover; display: block; }'
                    .' .ai-prod-body { padding: 14px; display: flex; flex-direction: column; gap: 8px; }'
                    .' .ai-prod-body h3 { font-size: 0.95rem; font-weight: 700; margin: 0; }'
                    .' .ai-prod-body h3 a { color: var(--ai-text); text-decoration: none; }'
                    .' .ai-prod-prices { display: flex; align-items: baseline; gap: 8px; }'
                    .' .ai-prod-prices strong { color: var(--ai-primary); font-weight: 800; }'
                    .' .ai-prod-prices del { color: var(--ai-muted); font-size: 0.8rem; }'
                    .' .ai-add-btn { padding: 8px 12px; border-radius: var(--ai-radius); border: none; background: var(--ai-primary); color: var(--ai-on-primary); font-weight: 700; }',
                'fields' => [
                    ['key' => 'banner_image', 'type' => 'image', 'label' => 'صورة البنر'],
                    ['key' => 'title', 'type' => 'text', 'label' => 'عنوان البنر', 'sample' => 'أحدث تشكيلة الموسم'],
                    ['key' => 'subtitle', 'type' => 'textarea', 'label' => 'وصف البنر', 'sample' => 'اختار من أفضل المنتجات المختارة بعناية بأفضل الأسعار.'],
                    ['key' => 'featured_products', 'type' => 'products', 'label' => 'منتجات السلايدر', 'sample' => 4],
                ],
            ],
        ], JSON_UNESCAPED_UNICODE);
    }

    /** @var list<array{model: string, prompt: string, edit: bool}> */
    public array $images = [];

    public function generateImage(string $model, string $prompt, string $aspect = '1:1'): AiImage
    {
        $this->images[] = ['model' => $model, 'prompt' => $prompt, 'edit' => false];

        return new AiImage(self::png(hexdec(substr(hash('sha256', $prompt), 0, 6))), 'image/png', $model, 0.0);
    }

    public function editImage(string $model, string $imageDataUrl, string $instruction, string $aspect = '1:1'): AiImage
    {
        $this->images[] = ['model' => $model, 'prompt' => $instruction, 'edit' => true];

        return new AiImage(self::png(hexdec(substr(hash('sha256', $instruction), 0, 6))), 'image/png', $model, 0.0);
    }

    /** A real 512×512 PNG of one soft colour (GD), so saving and showing it works like a real image. */
    private static function png(int $rgb): string
    {
        $image = imagecreatetruecolor(512, 512);
        imagefill($image, 0, 0, (int) imagecolorallocate($image, 128 + (($rgb >> 16) & 127), 128 + (($rgb >> 8) & 127), 128 + ($rgb & 127)));
        ob_start();
        imagepng($image);

        return (string) ob_get_clean();
    }

    public function embed(string $model, array $texts): AiEmbeddings
    {
        $this->embedded[] = array_values($texts);

        return new AiEmbeddings(array_map(fn (string $t) => self::vector($t), array_values($texts)), $model, inputTokens: 10 * count($texts));
    }

    /** @return list<float> */
    public static function vector(string $text, int $size = 16): array
    {
        $hash = hash('sha256', mb_strtolower(trim($text)));

        return array_map(fn (int $i) => (hexdec(substr($hash, $i * 2, 2)) - 127.5) / 127.5, range(0, $size - 1));
    }
}
