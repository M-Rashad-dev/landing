<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions;

use App\Ai\Ai;
use App\Ai\AiCost;
use App\Ai\AiUnavailable;
use App\Ai\Copilot\Changes\JobEstimate;
use App\Ai\Copilot\Changes\JobResult;
use App\Ai\Copilot\Changes\Selector;
use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotCatalog;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Ai\Designer\AiImages;
use App\Ai\MediaDataUrl;
use App\Exceptions\ApiException;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;

/**
 * An AI image for any record with one editable image field (a shipping company's logo, a category's picture, and any
 * later resource that declares `Field::media(...)->images()->editable()`), so a new feature gets images with no code
 * here. Generates (or improves the current image), estimated cost first, ≤ 20 per run, then the usual preview.
 * Product photos (many per product) have their own action, products.images.
 */
final class RecordsImage extends CopilotAction
{
    public const MAX = 20;

    public function __construct(private readonly Ai $ai, private readonly AiImages $images, private readonly CopilotCatalog $catalog) {}

    public function key(): string
    {
        return 'records.image';
    }

    public function label(): string
    {
        return 'صورة بالذكاء الاصطناعي';
    }

    public function summary(): string
    {
        return 'AI image (or logo) for records of a resource that has an image field (e.g. shipping_companies logo, categories picture), ≤ 20 per run: generate, or improve the current image. Not for products (use products.images).';
    }

    public function schema(): array
    {
        return ['type' => 'object', 'required' => ['resource', 'prompt'], 'properties' => [
            'resource' => ['type' => 'string', 'description' => 'Resource key with an image field (see describe: a field of type media).'],
            'field' => ['type' => 'string', 'description' => 'The image field, when the resource has more than one.'],
            'selector' => ['type' => 'object', 'description' => 'Like update_records. Default: the records with no image yet.'],
            'mode' => ['type' => 'string', 'enum' => ['generate', 'improve'], 'description' => 'Default generate.'],
            'prompt' => ['type' => 'string', 'description' => 'What the image should look like, in English (style, colors, symbol). The record name is added for each one. ≤ 400 chars.'],
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
        $resource = $this->catalog->resource((string) ($args['resource'] ?? ''), $ctx);
        if ($resource === null || $resource->key() === 'products') {
            throw new CopilotToolError($resource?->key() === 'products' ? 'For product photos use products.images.' : 'Unknown resource.');
        }
        $field = self::field($resource, isset($args['field']) ? (string) $args['field'] : null);
        $mode = ($args['mode'] ?? 'generate') === 'improve' ? 'improve' : 'generate';
        $prompt = mb_substr(trim((string) ($args['prompt'] ?? '')), 0, 400);
        if ($prompt === '' && $mode === 'generate') {
            throw new CopilotToolError('prompt is required: describe the image.');
        }
        $selector = is_array($args['selector'] ?? null) ? $args['selector'] : null;
        $ids = $selector !== null
            ? Selector::ids($resource, $selector, $ctx)
            : $resource->query($ctx)->whereNull($field->column)->limit(self::MAX + 1)->pluck($resource->query($ctx)->getModel()->getKeyName())->map(fn ($id) => (int) $id)->all();
        $rows = $resource->query($ctx)->whereKey($ids)->get();
        if ($mode === 'improve') {
            $rows = $rows->filter(fn ($row) => $row->getAttribute($field->column) !== null)->values();
        }
        if ($rows->count() > self::MAX) {
            throw new CopilotToolError('That is '.$rows->count().' records; one run makes at most '.self::MAX.' images. Narrow the selection.');
        }
        $usd = $rows->count() * (float) (AiCost::imagePrice(Ai::model($mode === 'improve' ? 'image_edit' : 'image_generate')) ?? 0);

        return new JobEstimate(
            summary: (string) __('ai.copilot.record_images_summary', ['count' => $rows->count(), 'label' => $resource->label()]),
            count: $rows->count(),
            usd: $usd,
            spec: ['resource' => $resource->key(), 'field' => $field->key, 'ids' => $rows->modelKeys(), 'mode' => $mode, 'prompt' => $prompt],
        );
    }

    public function work(CopilotChangeSet $set, CopilotContext $ctx): JobResult
    {
        $spec = (array) $set->spec;
        $resource = $this->catalog->resource((string) ($spec['resource'] ?? ''), $ctx) ?? throw new CopilotToolError('Unknown resource.');
        $field = self::field($resource, (string) ($spec['field'] ?? ''));
        $improve = ($spec['mode'] ?? 'generate') === 'improve';
        $prompt = (string) ($spec['prompt'] ?? '');
        $items = [];
        $stop = null;

        foreach ($resource->query($ctx)->whereKey(array_map('intval', (array) ($spec['ids'] ?? [])))->get() as $row) {
            $label = $resource->labelOf($row);
            $current = $row->getAttribute($field->column);
            $current = $current === null ? null : (int) $current;
            if ($stop !== null) {
                $items[] = self::failed((int) $row->getKey(), $label, $stop);

                continue;
            }
            try {
                if ($improve) {
                    $source = $current !== null ? MediaDataUrl::for($current) : null;
                    if ($source === null) {
                        $items[] = self::failed((int) $row->getKey(), $label, (string) __('ai.copilot.images_no_source'));

                        continue;
                    }
                    $image = $this->ai->imagePaid($ctx->tenant, 'copilot', 'image_edit', fn ($client, string $model) => $client->editImage($model, $source, self::instruction($prompt)), (string) __('ai.copilot.record_images_charge'));
                } else {
                    $image = $this->ai->imagePaid($ctx->tenant, 'copilot', 'image_generate', fn ($client, string $model) => $client->generateImage($model, self::prompt($prompt, $label), '1:1'), (string) __('ai.copilot.record_images_charge'));
                }
                $media = $this->images->store($ctx->tenant, $image, $label, $label);
                $items[] = ['entity_id' => (int) $row->getKey(), 'label' => $label, 'before' => [$field->key => $current], 'after' => [$field->key => (int) $media->id]];
            } catch (ApiException $e) {
                // Balance or storage ran out: stop here, list the rest.
                $stop = $e->getMessage();
                $items[] = self::failed((int) $row->getKey(), $label, $stop);
            } catch (AiUnavailable) {
                $items[] = self::failed((int) $row->getKey(), $label, (string) __('ai.designer.image_failed'));
            }
        }

        return new JobResult($resource->key(), (string) __('ai.copilot.record_images_result', ['count' => count(array_filter($items, fn ($i) => ($i['status'] ?? CopilotChangeItem::PENDING) === CopilotChangeItem::PENDING))]), $items);
    }

    /** The resource's editable single-image field (the named one, or the only one). */
    private static function field(CopilotResource $resource, ?string $key): Field
    {
        $fields = array_values(array_filter($resource->fields(), fn (Field $f) => $f->type === 'media' && $f->media && $f->editable));
        if ($fields === []) {
            throw new CopilotToolError("{$resource->key()} has no image field.");
        }
        foreach ($fields as $field) {
            if ($field->key === $key) {
                return $field;
            }
        }
        if (count($fields) > 1 && $key !== null && $key !== '') {
            throw new CopilotToolError('field must be one of: '.implode(', ', array_map(fn (Field $f) => $f->key, $fields)));
        }

        return $fields[0];
    }

    private static function prompt(string $prompt, string $label): string
    {
        return trim($prompt.' Subject: «'.$label.'». Square, clean, professional, sharp. No watermark.');
    }

    private static function instruction(string $prompt): string
    {
        return trim('Improve this image: '.($prompt !== '' ? $prompt : 'better light, sharpness and colors, clean background').'. Keep its subject and any text as they are.');
    }

    /** @return array<string, mixed> */
    private static function failed(int $id, string $label, string $why): array
    {
        return ['entity_id' => $id, 'label' => $label, 'before' => [], 'after' => [], 'status' => CopilotChangeItem::FAILED, 'note' => mb_substr($why, 0, 200)];
    }
}
