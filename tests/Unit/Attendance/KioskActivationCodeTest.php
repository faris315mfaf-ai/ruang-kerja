<?php

use App\Domain\Attendance\Support\KioskActivationCode;

test('generated codes are 8 unambiguous characters grouped 4-4', function () {
    $codes = array_map(fn (): string => KioskActivationCode::generate(), range(1, 200));

    foreach ($codes as $code) {
        expect($code)->toMatch('/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/')
            ->and($code)->not->toMatch('/[01ILO]/');
    }

    expect(count(array_unique($codes)))->toBeGreaterThan(195);
});

test('the alphabet has no look-alike characters', function () {
    expect(KioskActivationCode::ALPHABET)->not->toMatch('/[01ILO]/')
        ->and(strlen(KioskActivationCode::ALPHABET))->toBe(31)
        ->and(count(array_unique(str_split(KioskActivationCode::ALPHABET))))->toBe(31);
});

test('input is normalized or rejected', function (string $input, ?string $expected) {
    expect(KioskActivationCode::normalize($input))->toBe($expected);
})->with([
    ['ABCD-2345', 'ABCD2345'],
    ['abcd2345', 'ABCD2345'],
    [' ab cd 23 45 ', 'ABCD2345'],
    ['ABCD_2345', 'ABCD2345'],
    ['ABCD-234', null],
    ['ABCD-23456', null],
    ['ABCD-0345', null],
    ['ABCO-2345', null],
    ['ABCD-23%5', null],
    ['', null],
]);

test('codes are formatted in two groups', function () {
    expect(KioskActivationCode::format('ABCD2345'))->toBe('ABCD-2345');
});
