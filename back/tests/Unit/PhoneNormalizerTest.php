<?php

declare(strict_types=1);

use App\Services\PhoneNormalizer;

dataset('valid phones', [
    'local 010' => ['01012345678', '+201012345678'],
    'local 011' => ['01112345678', '+201112345678'],
    'local 012' => ['01212345678', '+201212345678'],
    'local 015' => ['01512345678', '+201512345678'],
    'plus country' => ['+201012345678', '+201012345678'],
    'double zero' => ['00201012345678', '+201012345678'],
    'no plus' => ['201012345678', '+201012345678'],
    'spaces and dashes' => ['010 1234-5678', '+201012345678'],
    'parentheses' => ['(010) 1234 5678', '+201012345678'],
    'arabic-indic digits' => ['٠١٠١٢٣٤٥٦٧٨', '+201012345678'],
    'persian digits' => ['۰۱۰۱۲۳۴۵۶۷۸', '+201012345678'],
]);

dataset('invalid phones', [
    'landline' => ['0223456789'],
    'wrong prefix 013' => ['01312345678'],
    'too short' => ['0101234567'],
    'too long' => ['010123456789'],
    'letters' => ['01012345abc'],
    'empty' => [''],
    'foreign' => ['+966512345678'],
]);

it('normalizes valid egyptian mobiles', function (string $input, string $expected) {
    expect((new PhoneNormalizer)->normalize($input))->toBe($expected);
})->with('valid phones');

it('rejects invalid numbers', function (string $input) {
    expect((new PhoneNormalizer)->normalize($input))->toBeNull()
        ->and((new PhoneNormalizer)->isValid($input))->toBeFalse();
})->with('invalid phones');

it('returns null for null input', function () {
    expect((new PhoneNormalizer)->normalize(null))->toBeNull();
});
