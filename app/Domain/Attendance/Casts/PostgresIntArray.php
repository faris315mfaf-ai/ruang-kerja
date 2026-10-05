<?php

namespace App\Domain\Attendance\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

/**
 * Casts a PostgreSQL integer array (e.g. smallint[] "{1,2,3}") to list<int>.
 *
 * @implements CastsAttributes<list<int>, iterable<int|string>>
 */
final class PostgresIntArray implements CastsAttributes
{
    /**
     * @param  array<string, mixed>  $attributes
     * @return list<int>
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): array
    {
        if ($value === null || $value === '' || $value === '{}') {
            return [];
        }

        if (! is_string($value)) {
            throw new InvalidArgumentException("Kolom {$key} bukan array PostgreSQL.");
        }

        $items = array_filter(explode(',', trim($value, '{}')), fn (string $item): bool => $item !== '' && strtoupper($item) !== 'NULL');

        return array_values(array_map(intval(...), $items));
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): string
    {
        if ($value === null) {
            return '{}';
        }

        $numbers = [];

        foreach ($value as $item) {
            $numbers[] = (int) $item;
        }

        $numbers = array_values(array_unique($numbers));
        sort($numbers);

        return '{'.implode(',', $numbers).'}';
    }
}
