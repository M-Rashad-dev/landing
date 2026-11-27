<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Ai\Quiz\ProductVectors;
use App\Tenancy\Tenancy;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/** Vectors for a store's products, for its AI quiz over a big catalog (one run per store at a time). */
final class EmbedProductVectors implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;

    public int $uniqueFor = 600;

    public int $timeout = 600;

    /** @param list<int> $productIds the products to cover (empty = every sellable one) */
    public function __construct(public readonly int $tenantId, public readonly array $productIds = []) {}

    public function uniqueId(): string
    {
        return (string) $this->tenantId;
    }

    public function handle(ProductVectors $vectors): void
    {
        Tenancy::runAs($this->tenantId, fn () => $vectors->embedMissing($this->productIds));
    }
}
