<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions;

use App\Ai\AiImage;
use App\Ai\Copilot\Changes\JobEstimate;
use App\Ai\Copilot\Changes\JobResult;
use App\Ai\Copilot\Changes\Selector;
use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\CopilotCatalog;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Ai\Designer\AiImages;
use App\Exceptions\ApiException;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;
use App\Models\Identity;
use App\Models\Media;
use App\Models\Product;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\ImageManager;
use Throwable;

/**
 * The store's logo on product photos (owner, 2026-11-20): drawn by us (GD, no AI, free) on the first photo or on all
 * of them, in a corner, sized as a share of the photo width. New copies go to the media library (storage counted),
 * the originals stay, so «تراجع» puts them back. Runs in the background after «ابدأ», then a preview for «نفّذ».
 */
final class ProductsAddLogo extends CopilotAction
{
    public const MAX_PRODUCTS = 50;

    public const MAX_IMAGES = 100;

    public const POSITIONS = ['top_right', 'top_left', 'bottom_right', 'bottom_left'];

    public function __construct(private readonly AiImages $images, private readonly CopilotCatalog $catalog) {}

    public function key(): string
    {
        return 'products.add_logo';
    }

    public function label(): string
    {
        return 'اللوجو على صور المنتجات';
    }

    public function summary(): string
    {
        return 'Put the store logo (or an attached image) on product photos, free, ≤ '.self::MAX_PRODUCTS.' products / '.self::MAX_IMAGES.' photos per run: a corner, a size, the first photo or all photos. Default logo: the store identity logo.';
    }

    public function schema(): array
    {
        return ['type' => 'object', 'properties' => [
            'selector' => ['type' => 'object', 'description' => 'Like update_records. Default: every product that has photos.'],
            'logo_media_id' => ['type' => 'integer', 'description' => 'Media id of an image the merchant attached as the logo. Omit to use the store identity logo.'],
            'position' => ['type' => 'string', 'enum' => self::POSITIONS, 'description' => 'Corner, default top_right.'],
            'size_percent' => ['type' => 'integer', 'minimum' => 10, 'maximum' => 40, 'description' => 'Logo width as % of the photo width, default 20.'],
            'photos' => ['type' => 'string', 'enum' => ['first', 'all'], 'description' => 'The main photo only or every photo, default all.'],
        ]];
    }

    public function approval(): bool
    {
        return true;
    }

    /** It runs as a background job (many photos), with no charge: the estimate is 0. */
    public function costly(): bool
    {
        return true;
    }

    public function estimate(array $args, CopilotContext $ctx): JobEstimate
    {
        $logo = self::logoMedia($args['logo_media_id'] ?? null);
        $position = in_array($args['position'] ?? null, self::POSITIONS, true) ? (string) $args['position'] : 'top_right';
        $size = max(10, min(40, (int) ($args['size_percent'] ?? 20)));
        $all = ($args['photos'] ?? 'all') !== 'first';
        $resource = $this->catalog->resource('products', $ctx) ?? throw new CopilotToolError('Products are not available.');
        $selector = is_array($args['selector'] ?? null) ? $args['selector'] : null;
        $query = Product::query()->has('media')->with('media')->orderBy('id');
        if ($selector !== null) {
            $query->whereKey(Selector::ids($resource, $selector, $ctx));
        }
        $products = $query->limit(self::MAX_PRODUCTS + 1)->get();
        if ($products->count() > self::MAX_PRODUCTS) {
            throw new CopilotToolError('More than '.self::MAX_PRODUCTS.' products have photos; one run takes at most '.self::MAX_PRODUCTS.'. Narrow the selection (e.g. a category).');
        }
        $photos = $products->sum(fn (Product $p) => $all ? $p->media->count() : 1);
        if ($photos > self::MAX_IMAGES) {
            throw new CopilotToolError("That is {$photos} photos; one run takes at most ".self::MAX_IMAGES.'. Narrow the selection or use photos: first.');
        }

        return new JobEstimate(
            summary: (string) __('ai.copilot.logo_summary', ['products' => $products->count(), 'photos' => $photos]),
            count: $products->count(),
            usd: 0.0,
            spec: ['ids' => $products->modelKeys(), 'logo' => $logo->id, 'position' => $position, 'size' => $size, 'all' => $all],
        );
    }

    public function work(CopilotChangeSet $set, CopilotContext $ctx): JobResult
    {
        $spec = (array) $set->spec;
        $logo = Media::query()->find((int) ($spec['logo'] ?? 0));
        $logoBytes = $logo instanceof Media ? self::bytes($logo) : null;
        if ($logoBytes === null) {
            throw new ApiException(422, 'logo_missing', (string) __('ai.copilot.logo_missing'));
        }
        $manager = ImageManager::gd(autoOrientation: true, decodeAnimation: false, strip: true);
        $position = str_replace('_', '-', (string) ($spec['position'] ?? 'top_right'));
        $size = (int) ($spec['size'] ?? 20);
        $all = (bool) ($spec['all'] ?? true);
        $products = Product::query()->with('media')->whereKey(array_map('intval', (array) ($spec['ids'] ?? [])))->orderBy('id')->get();
        $items = [];
        $stop = null;

        foreach ($products as $product) {
            $current = $product->media->pluck('id')->map(fn ($id) => (int) $id)->all();
            if ($stop !== null || $current === []) {
                $items[] = $this->failed($product, $stop ?? (string) __('ai.copilot.images_no_source'));

                continue;
            }
            $after = $current;
            try {
                foreach ($product->media->take($all ? 10 : 1)->values() as $i => $media) {
                    $bytes = self::bytes($media);
                    if ($bytes === null) {
                        continue;
                    }
                    $made = self::compose($manager, $bytes, $logoBytes, $position, $size);
                    $after[$i] = $this->images->store($ctx->tenant, new AiImage($made, 'image/webp', 'logo'), $product->name, $media->alt ?? $product->name)->id;
                }
            } catch (ApiException $e) {
                // Storage ran out: stop here, list the rest.
                $stop = $e->getMessage();
                $items[] = $this->failed($product, $stop);

                continue;
            } catch (Throwable $e) {
                report($e);
                $items[] = $this->failed($product, (string) __('ai.copilot.images_no_source'));

                continue;
            }
            $items[] = $after === $current
                ? $this->failed($product, (string) __('ai.copilot.images_no_source'))
                : ['entity_id' => $product->id, 'label' => $product->name, 'before' => ['media_ids' => $current], 'after' => ['media_ids' => $after]];
        }

        return new JobResult('products', (string) __('ai.copilot.logo_result', ['count' => count(array_filter($items, fn ($i) => ($i['status'] ?? CopilotChangeItem::PENDING) === CopilotChangeItem::PENDING))]), $items);
    }

    /** The photo with the logo in a corner: the logo scaled to size% of the photo width, a 3% margin, WebP. */
    public static function compose(ImageManager $manager, string $photo, string $logo, string $position, int $size): string
    {
        $image = $manager->read($photo);
        $mark = $manager->read($logo);
        $width = max(16, (int) round($image->width() * $size / 100));
        $mark = $mark->width() > $width ? $mark->scaleDown(width: $width) : $mark->scale(width: $width);
        $margin = (int) round(min($image->width(), $image->height()) * 0.03);
        $image = $image->place($mark, $position, $margin, $margin);

        return $image->toWebp(quality: 85)->toString();
    }

    /** The logo to draw: the attached image with that media id, else the store identity logo (a tool error if none). */
    public static function logoMedia(mixed $mediaId): Media
    {
        if ($mediaId !== null) {
            return Media::query()->find((int) $mediaId)
                ?? throw new CopilotToolError('No image with that logo_media_id in this store.');
        }
        $id = Identity::query()->where('is_default', true)->value('logo_media_id') ?? Identity::query()->whereNotNull('logo_media_id')->value('logo_media_id');

        return ($id !== null ? Media::query()->find((int) $id) : null)
            ?? throw new CopilotToolError('The store has no logo yet. Ask the merchant to attach the logo image here in the chat (then pass its media id as logo_media_id), or to add it in Settings → Identity.');
    }

    /** The largest stored copy of an image, or null when it can't be read. */
    public static function bytes(Media $media): ?string
    {
        $path = $media->variants['large'] ?? $media->path;
        $disk = Storage::disk($media->disk);
        if (! $disk->exists($path)) {
            return null;
        }
        $bytes = (string) $disk->get($path);

        return $bytes !== '' ? $bytes : null;
    }

    /** @return array<string, mixed> */
    private function failed(Product $product, string $why): array
    {
        return ['entity_id' => $product->id, 'label' => $product->name, 'before' => [], 'after' => [], 'status' => CopilotChangeItem::FAILED, 'note' => mb_substr($why, 0, 200)];
    }
}
