<?php

declare(strict_types=1);

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Tests\Fixtures\TestCatalogSeeder;

abstract class TestCase extends BaseTestCase
{
    /** Themes and plans are reference data every request needs (seeded after RefreshDatabase migrates), plus test-only paid themes. */
    protected bool $seed = true;

    protected string $seeder = TestCatalogSeeder::class;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withHeader('Accept', 'application/json');
    }
}
