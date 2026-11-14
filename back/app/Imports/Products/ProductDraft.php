<?php

declare(strict_types=1);

namespace App\Imports\Products;

/**
 * One product read from the sheet, ready for SaveProduct, or the reasons it cannot be saved.
 *
 * @phpstan-type Payload array<string, mixed>
 */
final class ProductDraft
{
    /**
     * @param  Payload  $payload  SaveProduct data (without images and categories)
     * @param  list<string>  $images  image links, in order
     * @param  list<list<string>>  $categories  category paths
     * @param  list<string>  $errors  why it cannot be saved (empty = fine)
     * @param  list<string>  $notes  translation keys of import-wide notes it caused
     */
    public function __construct(
        public readonly int $line,
        public readonly string $name,
        public readonly ?string $sku,
        public readonly ?string $identifier,
        public readonly array $payload,
        public readonly array $images,
        public readonly array $categories,
        public readonly array $errors,
        public readonly array $notes,
    ) {}

    public function valid(): bool
    {
        return $this->errors === [];
    }
}
