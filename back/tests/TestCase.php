<?php

declare(strict_types=1);

namespace Tests;

use Database\Seeders\ThemeSeeder;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /** Themes are reference data every page needs (seeded after RefreshDatabase migrates). */
    protected bool $seed = true;

    protected string $seeder = ThemeSeeder::class;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withHeader('Accept', 'application/json');
    }
}
