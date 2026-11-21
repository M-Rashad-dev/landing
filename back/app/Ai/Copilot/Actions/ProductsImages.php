<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions;

use App\Ai\Ai;
use App\Ai\AiCost;
use App\Ai\AiImage;
use App\Ai\AiUnavailable;
use App\Ai\Copilot\Changes\JobEstimate;
use App\Ai\Copilot\Changes\JobResult;
use App\Ai\Copilot\Changes\Selector;
use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\CopilotCatalog;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Ai\Designer\AiImages;
use App\Ai\MediaDataUrl;
use App\Exceptions\ApiException;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;
use App\Models\Media;
use App\Models\Product;
use Illuminate\Support\Collection;
use Intervention\Image\ImageManager;
use Throwable;

/**
 * Product photos with AI (owner, 2026-11-20): products with no image get a generated one; products with photos get
 * their first photo improved (remove the background, studio background, better light). Estimated cost first, at most
 * 20 per run, saved to the media library (storage counted), then a preview: the new photo goes first on «نفّذ».
 * `logo`: the store logo drawn on the new photos in the same run (as products.add_logo does), so «make a photo with my
 * logo» is one card, not two.
 */
final class ProductsImages extends CopilotAction
{
    public const MAX = 20;

    public const STYLES = ['studio', 'remove_bg', 'enhance'];

    public function __construct(private readonly Ai $ai, private readonly AiImages $images, private readonly CopilotCatalog $catalog) {}

    public function key(): string
    {
        return 'products.images';
    }

    public function label(): string
    {
        return 'صور المنتجات بالذكاء الاصطناعي';
    }

    public function summary(): string
    {
        return 'Product photos with AI, ≤ 20 per run: mode auto (no image → generate one, has photos → improve the first), generate, or improve; style for improving: studio | remove_bg | enhance. logo: true puts the store logo (or an attached logo_media_id) on the new photos in the same run.';
    }

    public function schema(): array
    {
        return ['type' => 'object', 'properties' => [
            'selector' => ['type' => 'object', 'description' => 'Like update_records. Default with mode auto/generate: products without images.'],
            'mode' => ['type' => 'string', 'enum' => ['auto', 'generate', 'improve'], 'description' => 'Default auto.'],
            'style' => ['type' => 'string', 'enum' => self::STYLES, 'description' => 'How to improve (default studio).'],
            'notes' => ['type' => 'string', 'description' => 'The merchant\'s wishes for the look (English or Arabic), ≤ 300 chars.'],
            'logo' => ['type' => 'boolean', 'description' => 'Draw the store logo on the new photos (when the merchant wants his logo on them).'],
            'logo_media_id' => ['type' => 'integer', 'description' => 'With logo: media id of a logo image the merchant attached (default: the store identity logo).'],
            'logo_position' => ['type' => 'string', 'enum' => ProductsAddLogo::POSITIONS, 'description' => 'With logo: the corner, default top_right.'],
            'logo_size_percent' => ['type' => 'integer', 'minimum' => 10, 'maximum' => 40, 'description' => 'With logo: width as % of the photo, default 20.'],
        ]];
    }

    public function approval(): bool
    {
        return true;
    }

    public function costly(): bool
    {
        return true;
    }

    public function estimate(array $args, CopilotContext $ctx): JobEstimate
    {
        $mode = in_array($args['mode'] ?? 'auto', ['auto', 'generate', 'improve'], true) ? (string) ($args['mode'] ?? 'auto') : 'auto';
        $style = in_array($args['style'] ?? 'studio', self::STYLES, true) ? (string) ($args['style'] ?? 'studio') : 'studio';
        $resource = $this->catalog->resource('products', $ctx) ?? throw new CopilotToolError('Products are not available.');
        $selector = is_array($args['selector'] ?? null) ? $args['selector'] : null;
        $ids = $selector !== null ? Selector::ids($resource, $selector, $ctx) : Product::query()->doesntHave('media')->limit(self::MAX + 1)->pluck('id')->map(fn ($id) => (int) $id)->all();
        $products = Product::query()->with(['media', 'categories:id,name'])->whereKey($ids)->orderBy('id')->get();

        $plan = [];
        foreach ($products as $product) {
            $has = $product->media->isNotEmpty();
            $op = match ($mode) {
                'generate' => 'generate',
                'improve' => $has ? 'improve' : null,
                default => $has ? 'improve' : 'generate',
            };
            if ($op !== null) {
                $plan[$product->id] = $op;
            }
        }
        if (count($plan) > self::MAX) {
            throw new CopilotToolError('That is '.count($plan).' products; one run makes at most '.self::MAX.' images. Narrow the selection.');
        }
        $generate = count(array_filter($plan, fn (string $op) => $op === 'generate'));
        $improve = count($plan) - $generate;
        $usd = $generate * (float) (AiCost::imagePrice(Ai::model('image_generate')) ?? 0) + $improve * (float) (AiCost::imagePrice(Ai::model('image_edit')) ?? 0);
        $logo = ($args['logo'] ?? false) || isset($args['logo_media_id']) ? [
            'media' => ProductsAddLogo::logoMedia($args['logo_media_id'] ?? null)->id,
            'position' => in_array($args['logo_position'] ?? null, ProductsAddLogo::POSITIONS, true) ? (string) $args['logo_position'] : 'top_right',
            'size' => max(10, min(40, (int) ($args['logo_size_percent'] ?? 20))),
        ] : null;

        return new JobEstimate(
            summary: (string) __('ai.copilot.images_summary', ['generate' => $generate, 'improve' => $improve]).($logo !== null ? (string) __('ai.copilot.images_with_logo') : ''),
            count: count($plan),
            usd: $usd,
            spec: ['plan' => $plan, 'style' => $style, 'notes' => mb_substr(trim((string) ($args['notes'] ?? '')), 0, 300), 'logo' => $logo],
        );
    }

    public function work(CopilotChangeSet $set, CopilotContext $ctx): JobResult
    {
        $plan = array_map('strval', (array) ($set->spec['plan'] ?? []));
        $style = (string) ($set->spec['style'] ?? 'studio');
        $notes = (string) ($set->spec['notes'] ?? '');
        /** @var Collection<int, Product> $products */
        $products = Product::query()->with(['media', 'categories:id,name'])->whereKey(array_map('intval', array_keys($plan)))->orderBy('id')->get();
        $logo = $this->logoBytes($set->spec['logo'] ?? null);
        $items = [];
        $stop = null;

        foreach ($products as $product) {
            $op = $plan[(string) $product->id] ?? $plan[$product->id] ?? 'generate';
            $current = $product->media->pluck('id')->map(fn ($id) => (int) $id)->all();
            if ($stop !== null) {
                $items[] = $this->failed($product, $stop);

                continue;
            }
            try {
                if ($op === 'improve') {
                    $source = $current !== [] ? MediaDataUrl::for($current[0]) : null;
                    if ($source === null) {
                        $items[] = $this->failed($product, (string) __('ai.copilot.images_no_source'));

                        continue;
                    }
                    $image = $this->ai->imagePaid($ctx->tenant, 'copilot', 'image_edit', fn ($client, string $model) => $client->editImage($model, $source, self::instruction($style, $notes)), (string) __('ai.copilot.images_charge'));
                    $media = $this->images->store($ctx->tenant, $this->stamp($image, $logo), $product->name, $product->name);
                    $after = [$media->id, ...array_slice($current, 1)];
                } else {
                    $image = $this->ai->imagePaid($ctx->tenant, 'copilot', 'image_generate', fn ($client, string $model) => $client->generateImage($model, self::prompt($product, $notes), '1:1'), (string) __('ai.copilot.images_charge'));
                    $media = $this->images->store($ctx->tenant, $this->stamp($image, $logo), $product->name, $product->name);
                    $after = [$media->id, ...$current];
                }
                $items[] = ['entity_id' => $product->id, 'label' => $product->name, 'before' => ['media_ids' => $current], 'after' => ['media_ids' => array_slice($after, 0, 10)]];
            } catch (ApiException $e) {
                // Balance or storage ran out: stop here, list the rest (what was made is in the library).
                $stop = $e->getMessage();
                $items[] = $this->failed($product, $stop);
            } catch (AiUnavailable $e) {
                // Nothing was charged. A provider hiccup may pass for the next product; anything else stops the run.
                $why = $e->reasonText().' '.__('ai.copilot.not_charged');
                $stop = $e->retryable() ? null : $why;
                $items[] = $this->failed($product, $why);
            }
        }

        return new JobResult('products', (string) __('ai.copilot.images_result', ['count' => count(array_filter($items, fn ($i) => ($i['status'] ?? CopilotChangeItem::PENDING) === CopilotChangeItem::PENDING))]), $items);
    }

    /**
     * The logo's bytes and placement for this run, or null (no logo asked).
     *
     * @return array{bytes: string, position: string, size: int}|null
     */
    private function logoBytes(mixed $spec): ?array
    {
        if (! is_array($spec)) {
            return null;
        }
        $media = Media::query()->find((int) ($spec['media'] ?? 0));
        $bytes = $media instanceof Media ? ProductsAddLogo::bytes($media) : null;
        if ($bytes === null) {
            throw new ApiException(422, 'logo_missing', (string) __('ai.copilot.logo_missing'));
        }

        return ['bytes' => $bytes, 'position' => str_replace('_', '-', (string) ($spec['position'] ?? 'top_right')), 'size' => (int) ($spec['size'] ?? 20)];
    }

    /**
     * The new photo with the logo drawn on it (the photo alone if that fails: it is paid for already).
     *
     * @param  array{bytes: string, position: string, size: int}|null  $logo
     */
    private function stamp(AiImage $image, ?array $logo): AiImage
    {
        if ($logo === null) {
            return $image;
        }
        try {
            $made = ProductsAddLogo::compose(ImageManager::gd(autoOrientation: true, decodeAnimation: false, strip: true), $image->bytes, $logo['bytes'], $logo['position'], $logo['size']);

            return new AiImage($made, 'image/webp', $image->model, $image->costUsd);
        } catch (Throwable $e) {
            report($e);

            return $image;
        }
    }

    /** A product photo request in English (image models follow it best); no text, logos or brands in the image. */
    private static function prompt(Product $product, string $notes): string
    {
        $category = $product->categories->pluck('name')->first();

        return trim('Professional e-commerce product photo of: '.$product->name.($category ? " (category: {$category})" : '').'. '
            .($notes !== '' ? "Merchant's wishes: {$notes}. " : '')
            .'Realistic, sharp, centered, soft studio lighting, clean light background, square. No text, no logos, no watermark, no people.');
    }

    private static function instruction(string $style, string $notes): string
    {
        $base = match ($style) {
            'remove_bg' => 'Remove the background completely and put the product on a pure white background.',
            'enhance' => 'Improve the lighting, sharpness and colors of this photo.',
            default => 'Put this product on a clean professional studio background with a soft natural shadow.',
        };

        return $base.' Keep the product exactly as it is (shape, color, labels). No added text or logos.'.($notes !== '' ? " Merchant's wishes: {$notes}." : '');
    }

    /** @return array<string, mixed> */
    private function failed(Product $product, string $why): array
    {
        return ['entity_id' => $product->id, 'label' => $product->name, 'before' => [], 'after' => [], 'status' => CopilotChangeItem::FAILED, 'note' => mb_substr($why, 0, 200)];
    }
}
