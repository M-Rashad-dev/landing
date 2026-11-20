<?php

declare(strict_types=1);

use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\Contracts\CopilotReport;
use App\Ai\Copilot\Contracts\CopilotResource;
use App\Ai\Copilot\Contracts\Field;
use App\Ai\Copilot\CopilotCatalog;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\CopilotTools;
use App\Ai\Copilot\Support\ToolResult;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;

/** A well-formed read-only resource (fixture). */
final class FixtureProductsResource extends CopilotResource
{
    public function key(): string
    {
        return 'fixture_products';
    }

    public function label(): string
    {
        return 'منتجات تجربة';
    }

    public function summary(): string
    {
        return 'Test products.';
    }

    public function model(): string
    {
        return Product::class;
    }

    public function fields(): array
    {
        return [Field::text('name')->label('الاسم')->searchable(), Field::money('price')->label('السعر')->filterable()->sortable()];
    }
}

/** Breaks the contract: a forbidden model and a bad key. */
final class FixtureUsersResource extends CopilotResource
{
    public function key(): string
    {
        return 'Users!';
    }

    public function label(): string
    {
        return 'المستخدمين';
    }

    public function summary(): string
    {
        return 'Never allowed.';
    }

    public function model(): string
    {
        return User::class;
    }

    public function fields(): array
    {
        return [Field::text('email')];
    }
}

final class FixtureCheckAction extends CopilotAction
{
    public function key(): string
    {
        return 'fixture.check';
    }

    public function label(): string
    {
        return 'فحص';
    }

    public function summary(): string
    {
        return 'A safe check.';
    }

    public function schema(): array
    {
        return ['type' => 'object', 'properties' => ['what' => ['type' => 'string']]];
    }

    public function approval(): bool
    {
        return false;
    }

    public function run(array $args, CopilotContext $ctx): ToolResult
    {
        return ToolResult::ok(['checked' => $args['what'] ?? null]);
    }
}

function contractCtx(): CopilotContext
{
    $tenant = Tenant::factory()->create();

    return new CopilotContext($tenant, User::factory()->for($tenant)->create());
}

it('keeps every discovered copilot capability within the contract', function () {
    foreach (CopilotCatalog::discover() as $class) {
        expect(CopilotCatalog::problems(app($class)))->toBe([], $class);
    }
    $keys = array_map(fn (string $class) => app($class)->key(), CopilotCatalog::discover());
    expect(count($keys))->toBe(count(array_unique($keys)));
});

it('finds only concrete capabilities in the copilot folders', function () {
    foreach (CopilotCatalog::discover() as $class) {
        expect($class)->toStartWith('App\\Ai\\Copilot\\')
            ->and(is_subclass_of($class, CopilotResource::class) || is_subclass_of($class, CopilotReport::class) || is_subclass_of($class, CopilotAction::class))->toBeTrue();
    }
});

it('refuses forbidden models and bad keys, and accepts good capabilities', function () {
    expect(CopilotCatalog::problems(new FixtureUsersResource))->toContain('forbidden model App\Models\User')->toContain('bad key «Users!»')
        ->and(CopilotCatalog::problems(new FixtureProductsResource))->toBe([])
        ->and(CopilotCatalog::problems(new FixtureCheckAction))->toBe([]);

    $catalog = new CopilotCatalog([FixtureProductsResource::class, FixtureUsersResource::class, FixtureCheckAction::class]);
    expect(array_keys($catalog->all()))->toBe(['fixture_products', 'fixture.check']);
});

it('writes one catalog line per capability and offers describe only when there is something', function () {
    $ctx = contractCtx();
    $empty = new CopilotCatalog([]);
    $full = new CopilotCatalog([FixtureProductsResource::class, FixtureCheckAction::class]);

    expect($empty->catalogText($ctx))->toContain('Nothing yet')
        ->and($full->catalogText($ctx))->toContain('- fixture_products: منتجات تجربة — find. Test products.')
        ->toContain('- fixture.check: فحص (runs at once). A safe check.');

    app()->instance(CopilotCatalog::class, $empty);
    expect(app(CopilotTools::class)->names($ctx))->toBe(['help_search', 'store_overview', 'open_page']);

    app()->instance(CopilotCatalog::class, $full);
    $tools = app(CopilotTools::class);
    expect($tools->names($ctx))->toContain('describe');
    $described = $tools->run('describe', ['name' => 'fixture_products'], $ctx)->data;
    expect($described['fields'][1])->toMatchArray(['key' => 'price', 'type' => 'money', 'filterable' => true, 'sortable' => true])
        ->and($tools->run('describe', ['name' => 'nothing'], $ctx)->failed)->toBeTrue();
});

it('cuts big tool results to a safe size and keeps them valid JSON', function () {
    $result = ToolResult::ok(['rows' => array_fill(0, 2000, ['name' => str_repeat('منتج ', 10)]), 'total' => 2000]);

    $json = $result->toJson();

    expect(strlen($json))->toBeLessThanOrEqual(ToolResult::MAX_BYTES)
        ->and(json_decode($json, true))->toHaveKey('truncated', true)->toHaveKey('total', 2000);
});
