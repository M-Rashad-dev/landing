<?php

declare(strict_types=1);

use App\Services\SubdomainGenerator;

it('builds an ascii base from latin names', function () {
    expect((new SubdomainGenerator)->base('Rashad Store'))->toBe('rashad-store');
});

it('transliterates arabic names', function () {
    $base = (new SubdomainGenerator)->base('متجر رشاد');

    expect($base)->toMatch('/^[a-z0-9]+(-[a-z0-9]+)*$/')->not->toBe('');
});

it('falls back to store when nothing usable remains', function (string $name) {
    expect((new SubdomainGenerator)->base($name))->toBe('store');
})->with(['', '   ', '!!!', '🙂🙂']);

it('cuts the base to 20 characters without a trailing dash', function () {
    $base = (new SubdomainGenerator)->base('a very long store name that keeps going');

    expect(strlen($base))->toBeLessThanOrEqual(20)
        ->and($base)->not->toEndWith('-');
});

it('detects reserved labels', function (string $label) {
    expect((new SubdomainGenerator)->isReserved($label))->toBeTrue();
})->with(['www', 'app', 'admin', 'cname', 'API']);

it('validates labels', function (string $label, bool $valid) {
    expect((new SubdomainGenerator)->isValidLabel($label))->toBe($valid);
})->with([
    ['my-store', true],
    ['abc', true],
    ['ab', false],
    ['-store', false],
    ['store-', false],
    ['my--store', false],
    ['My-Store', false],
    [str_repeat('a', 31), false],
]);
