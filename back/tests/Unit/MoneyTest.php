<?php

declare(strict_types=1);

use App\Support\Money;

it('converts decimal strings to cents without floats', function (string|int $input, int $cents) {
    expect(Money::toCents($input))->toBe($cents);
})->with([
    ['350', 35000],
    ['350.5', 35050],
    ['350.50', 35050],
    ['0.1', 10],
    ['19.99', 1999],
    ['1.005', 101],
    ['1.004', 100],
    [12, 1200],
    ['-2.50', -250],
]);

it('formats cents as decimal strings', function (int $cents, string $decimal) {
    expect(Money::toDecimal($cents))->toBe($decimal);
})->with([
    [35050, '350.50'],
    [5, '0.05'],
    [0, '0.00'],
    [-250, '-2.50'],
]);

it('rounds half up in integer division', function () {
    expect(Money::mulDivRound(70000, 25, 100))->toBe(17500)
        ->and(Money::mulDivRound(333, 1, 2))->toBe(167)
        ->and(Money::mulDivRound(332, 1, 2))->toBe(166)
        ->and(Money::mulDivRound(1, 1, 3))->toBe(0);
});
