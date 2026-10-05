<?php

use App\Domain\Tasks\Services\Lexorank;

it('starts in the middle of the key space', function () {
    expect(Lexorank::between(null, null))->toBe('V');
});

it('returns keys that sort strictly between their neighbours', function (?string $before, ?string $after) {
    $key = Lexorank::between($before, $after);

    expect(Lexorank::isValid($key))->toBeTrue();

    if ($before !== null) {
        expect(strcmp($before, $key))->toBeLessThan(0);
    }

    if ($after !== null) {
        expect(strcmp($key, $after))->toBeLessThan(0);
    }
})->with([
    'append' => ['V', null],
    'append after z' => ['z', null],
    'append after zz' => ['zz', null],
    'prepend' => [null, 'V'],
    'prepend before 1' => [null, '1'],
    'prepend before 01' => [null, '01'],
    'adjacent digits' => ['V', 'W'],
    'shared prefix' => ['VV', 'VW'],
    'prefix of the other' => ['V', 'V1'],
    'zero padded' => ['0V', '1'],
    'wide gap' => ['1', 'z'],
]);

it('keeps insertion order under thousands of random inserts', function () {
    mt_srand(20261005);
    $keys = [];

    for ($i = 0; $i < 3000; $i++) {
        $index = mt_rand(0, count($keys));
        $before = $keys[$index - 1] ?? null;
        $after = $keys[$index] ?? null;

        array_splice($keys, $index, 0, [Lexorank::between($before, $after)]);
    }

    $sorted = $keys;
    usort($sorted, strcmp(...));

    expect($sorted)->toBe($keys)
        ->and(array_unique($keys))->toHaveCount(3000)
        ->and(array_filter($keys, fn (string $key) => ! Lexorank::isValid($key)))->toBeEmpty();
});

it('grows slowly when appending or prepending 500 cards', function () {
    $last = null;
    $first = null;

    for ($i = 0; $i < 500; $i++) {
        $last = Lexorank::between($last, null);
        $first = Lexorank::between(null, $first);
    }

    expect(strlen((string) $last))->toBeLessThanOrEqual(20)
        ->and(strlen((string) $first))->toBeLessThanOrEqual(20);
});

it('builds evenly spaced, sorted and unique sequences', function (int $count, int $maxLength) {
    $keys = Lexorank::sequence($count);
    $sorted = $keys;
    usort($sorted, strcmp(...));

    expect($keys)->toHaveCount($count)
        ->and($sorted)->toBe($keys)
        ->and(array_unique($keys))->toHaveCount($count)
        ->and(max(array_map(strlen(...), $keys)))->toBeLessThanOrEqual($maxLength)
        ->and(array_filter($keys, fn (string $key) => ! Lexorank::isValid($key)))->toBeEmpty();
})->with([
    [1, 1],
    [5, 1],
    [60, 1],
    [500, 2],
    [5000, 3],
]);

it('returns an empty sequence for zero items', function () {
    expect(Lexorank::sequence(0))->toBe([]);
});

it('rejects invalid or unordered input', function (?string $before, ?string $after) {
    Lexorank::between($before, $after);
})->with([
    'same key' => ['V', 'V'],
    'reversed' => ['W', 'V'],
    'trailing zero' => ['V0', null],
    'empty' => ['', null],
    'bad digit' => [null, 'V-'],
])->throws(InvalidArgumentException::class);

it('validates keys', function () {
    expect(Lexorank::isValid('V'))->toBeTrue()
        ->and(Lexorank::isValid('0V'))->toBeTrue()
        ->and(Lexorank::isValid('V0'))->toBeFalse()
        ->and(Lexorank::isValid(''))->toBeFalse()
        ->and(Lexorank::isValid('a b'))->toBeFalse();
});
